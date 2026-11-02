"""Asset routes (api/assets.py): create, update, delete, ownership."""

import json
from decimal import Decimal

import pytest

from helpers import fresh, make_asset, make_budget
from models import Asset, Budget


def post_asset(client, budget_id, body):
    return client.post(f"/budgets/{budget_id}/assets", json=body)


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def asset(session, budget):
    return make_asset(session, budget)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


@pytest.fixture
def their_asset(session, their_budget):
    return make_asset(session, their_budget)


# ---------- login required ----------

@pytest.mark.parametrize("method, url", [
    ("post", "/budgets/1/assets"),
    ("patch", "/assets/1"),
    ("delete", "/assets/1"),
])
def test_no_session_is_401(client, method, url):
    resp = getattr(client, method)(url, json={})
    assert resp.status_code == 401
    assert "error" in resp.get_json()


def test_no_session_changes_nothing(client, session, asset):
    client.patch(f"/assets/{asset.id}", json={"name": "Hacked"})
    client.delete(f"/assets/{asset.id}")
    post_asset(client, asset.budget_id, {"name": "New", "balance": "1.00"})
    assert fresh(session, asset).name == "Checking"
    assert Asset.query.count() == 1


# ---------- POST /budgets/<id>/assets ----------

class TestCreate:
    def test_returns_201_and_the_asset(self, client_a, budget):
        resp = post_asset(client_a, budget.id, {"name": "  Savings  ", "balance": "1200"})
        assert resp.status_code == 201
        saved = Asset.query.one()
        assert saved.budget_id == budget.id
        assert saved.balance == Decimal("1200.00")
        assert resp.get_json() == {"id": saved.id, "name": "Savings", "balance": "1200.00"}

    def test_negative_balance_is_allowed(self, client_a, budget):
        resp = post_asset(client_a, budget.id, {"name": "Car loan", "balance": "-8500.25"})
        assert resp.status_code == 201
        assert resp.get_json()["balance"] == "-8500.25"

    def test_budget_id_comes_from_the_url_not_the_body(self, client_a, budget, their_budget):
        post_asset(client_a, budget.id, {"name": "Savings", "balance": "1.00", "budget_id": their_budget.id})
        assert Asset.query.one().budget_id == budget.id

    def test_shows_up_on_the_budget(self, client_a, budget):
        asset_id = post_asset(client_a, budget.id, {"name": "Savings", "balance": "1.00"}).get_json()["id"]
        nested = client_a.get(f"/budgets/{budget.id}").get_json()["assets"]
        assert [a["id"] for a in nested] == [asset_id]

    @pytest.mark.parametrize("body, error_field", [
        ({"balance": "1.00"}, "name"),
        ({"name": "Savings"}, "balance"),
        ({"name": "   ", "balance": "1.00"}, "name"),    # model ValueError
        ({"name": None, "balance": "1.00"}, "name"),
        ({"name": "Savings", "balance": None}, "balance"),
        ({"name": "Savings", "balance": "lots"}, "balance"),
        ({"name": "Savings", "balance": "100000000"}, "balance"),
        ({"name": "Savings", "balance": "-100000000"}, "balance"),
    ])
    def test_bad_body_is_422_and_creates_nothing(self, client_a, budget, body, error_field):
        resp = post_asset(client_a, budget.id, body)
        assert resp.status_code == 422
        assert error_field in resp.get_json()["errors"]
        assert Asset.query.count() == 0

    def test_missing_budget_is_404(self, client_a):
        assert post_asset(client_a, 9999, {"name": "Savings", "balance": "1.00"}).status_code == 404

    def test_someone_elses_budget_is_403_and_creates_nothing(self, client_a, their_budget):
        resp = post_asset(client_a, their_budget.id, {"name": "Savings", "balance": "1.00"})
        assert resp.status_code == 403
        assert Asset.query.count() == 0

    def test_ownership_is_checked_before_the_body(self, client_a, their_budget):
        assert post_asset(client_a, their_budget.id, {"name": "   "}).status_code == 403


# ---------- PATCH /assets/<id> ----------

class TestUpdate:
    def test_partial_update_keeps_other_fields(self, client_a, session, asset):
        resp = client_a.patch(f"/assets/{asset.id}", json={"name": " Main "})
        assert resp.status_code == 200
        assert resp.get_json() == {"id": asset.id, "name": "Main", "balance": "2500.00"}
        assert fresh(session, asset).name == "Main"

    def test_balance_can_go_negative(self, client_a, session, asset):
        resp = client_a.patch(f"/assets/{asset.id}", json={"balance": "-40.5"})
        assert resp.status_code == 200
        assert resp.get_json() == {"id": asset.id, "name": "Checking", "balance": "-40.50"}
        assert fresh(session, asset).balance == Decimal("-40.50")

    @pytest.mark.parametrize("bad, error_field", [
        ({"name": "   "}, "name"),
        ({"name": None}, "name"),
        ({"balance": None}, "balance"),
        ({"balance": "lots"}, "balance"),
        ({"balance": "100000000"}, "balance"),
    ])
    def test_bad_body_is_422_and_changes_nothing(self, client_a, session, asset, bad, error_field):
        # the valid change must not be saved either
        valid = {"balance": "1.00"} if "name" in bad else {"name": "Changed"}
        resp = client_a.patch(f"/assets/{asset.id}", json={**valid, **bad})
        assert resp.status_code == 422
        assert error_field in resp.get_json()["errors"]
        asset = fresh(session, asset)
        assert (asset.name, asset.balance) == ("Checking", Decimal("2500.00"))

    @pytest.mark.parametrize("body", [[1], "text", 5, None])
    def test_body_that_is_not_an_object_is_422(self, client_a, session, asset, body):
        resp = client_a.patch(f"/assets/{asset.id}", data=json.dumps(body), content_type="application/json")
        assert resp.status_code == 422
        assert "errors" in resp.get_json()
        assert fresh(session, asset).name == "Checking"

    def test_budget_id_in_body_cannot_move_the_asset(self, client_a, session, asset, budget, their_budget):
        resp = client_a.patch(f"/assets/{asset.id}", json={"budget_id": their_budget.id})
        assert resp.status_code == 200
        assert fresh(session, asset).budget_id == budget.id
        assert session.get(Budget, their_budget.id).assets == []

    def test_missing_is_404(self, client_a):
        assert client_a.patch("/assets/9999", json={"name": "X"}).status_code == 404

    def test_someone_elses_is_403_and_changes_nothing(self, client_a, session, their_asset):
        resp = client_a.patch(f"/assets/{their_asset.id}", json={"name": "Hacked"})
        assert resp.status_code == 403
        assert "error" in resp.get_json()
        assert fresh(session, their_asset).name == "Checking"

    def test_ownership_is_checked_before_the_body(self, client_a, their_asset):
        assert client_a.patch(f"/assets/{their_asset.id}", json={"name": "   "}).status_code == 403


# ---------- DELETE /assets/<id> ----------

class TestDelete:
    def test_returns_204_and_removes_only_that_asset(self, client_a, session, budget, asset):
        keep = make_asset(session, budget, name="Keep")
        resp = client_a.delete(f"/assets/{asset.id}")
        assert resp.status_code == 204
        assert resp.get_data() == b""
        session.expire_all()
        assert [a.id for a in Asset.query.all()] == [keep.id]
        assert session.get(Budget, budget.id) is not None

    def test_missing_is_404(self, client_a):
        assert client_a.delete("/assets/9999").status_code == 404

    def test_someone_elses_is_403_and_deletes_nothing(self, client_a, session, their_asset):
        resp = client_a.delete(f"/assets/{their_asset.id}")
        assert resp.status_code == 403
        session.expire_all()
        assert Asset.query.count() == 1

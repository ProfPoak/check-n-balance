"""Budget routes (api/budgets.py): CRUD, login required, ownership checks."""

from datetime import date

import pytest

from helpers import make_asset, make_budget, make_item
from models import Asset, Budget, CashFlowItem

LIST_KEYS = {"id", "title", "description", "balance_as_of"}
FULL_KEYS = LIST_KEYS | {"cash_flow_items", "assets"}


def fresh(session, obj):
    """Re-read obj from the database (routes commit in their own session)."""
    session.expire_all()
    return session.get(type(obj), obj.id)


# ---------- login required ----------

@pytest.mark.parametrize("method, url", [
    ("get", "/budgets"),
    ("post", "/budgets"),
    ("get", "/budgets/1"),
    ("patch", "/budgets/1"),
    ("delete", "/budgets/1"),
])
def test_no_session_is_401(client, method, url):
    resp = getattr(client, method)(url, json={})
    assert resp.status_code == 401
    assert "error" in resp.get_json()


def test_no_session_changes_nothing(client, session, user_a):
    budget = make_budget(session, user_a)
    client.patch(f"/budgets/{budget.id}", json={"title": "Hacked"})
    client.delete(f"/budgets/{budget.id}")
    client.post("/budgets", json={})
    assert fresh(session, budget).title == "Current"
    assert Budget.query.count() == 1


# ---------- GET /budgets ----------

class TestList:
    def test_empty_list(self, client_a):
        resp = client_a.get("/budgets")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_only_my_budgets_ordered_by_id_without_nested(self, client_a, session, user_a, user_b):
        first = make_budget(session, user_a, title="First")
        make_budget(session, user_b, title="Theirs")
        second = make_budget(session, user_a, title="Second")
        make_item(session, first)

        body = client_a.get("/budgets").get_json()
        assert [b["id"] for b in body] == [first.id, second.id]
        assert set(body[0]) == LIST_KEYS
        assert body[0] == {
            "id": first.id,
            "title": "First",
            "description": "Real numbers",
            "balance_as_of": "2026-10-01",
        }


# ---------- POST /budgets ----------

class TestCreate:
    def test_empty_body_gets_defaults(self, client_a, user_a):
        resp = client_a.post("/budgets", json={})
        assert resp.status_code == 201
        body = resp.get_json()
        assert set(body) == FULL_KEYS
        assert body["title"] == "Untitled budget"
        assert body["balance_as_of"] == date.today().isoformat()
        assert body["description"] is None
        assert body["cash_flow_items"] == [] and body["assets"] == []

        budget = Budget.query.one()
        assert budget.id == body["id"]
        assert budget.user_id == user_a.id

    def test_with_fields(self, client_a):
        resp = client_a.post("/budgets", json={
            "title": "  What if  ", "description": "New job", "balance_as_of": "2026-11-15",
        })
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["title"] == "What if"
        assert body["description"] == "New job"
        assert body["balance_as_of"] == "2026-11-15"

    def test_user_id_in_body_is_ignored(self, client_a, user_a, user_b):
        client_a.post("/budgets", json={"user_id": user_b.id})
        assert Budget.query.one().user_id == user_a.id

    @pytest.mark.parametrize("field, value", [
        ("title", "   "),        # model ValueError
        ("title", "x" * 51),     # model ValueError
        ("title", None),         # schema: not nullable
        ("balance_as_of", "not a date"),
        ("balance_as_of", None),
    ])
    def test_bad_body_is_422_and_creates_nothing(self, client_a, field, value):
        resp = client_a.post("/budgets", json={field: value})
        assert resp.status_code == 422
        assert field in resp.get_json()["errors"]
        assert Budget.query.count() == 0


# ---------- GET /budgets/<id> ----------

class TestShow:
    def test_returns_budget_with_items_and_assets(self, client_a, session, user_a):
        budget = make_budget(session, user_a)
        item = make_item(session, budget)
        asset = make_asset(session, budget)

        resp = client_a.get(f"/budgets/{budget.id}")
        assert resp.status_code == 200
        body = resp.get_json()
        assert set(body) == FULL_KEYS
        assert body["title"] == "Current"

        [got_item] = body["cash_flow_items"]
        assert got_item["id"] == item.id
        assert got_item["amount"] == "1200.50"
        assert got_item["start_date"] == "2026-10-03"

        [got_asset] = body["assets"]
        assert got_asset["id"] == asset.id
        assert got_asset["balance"] == "2500.00"

    def test_missing_is_404(self, client_a):
        resp = client_a.get("/budgets/9999")
        assert resp.status_code == 404
        assert "error" in resp.get_json()

    def test_someone_elses_is_403(self, client_a, session, user_b):
        budget = make_budget(session, user_b)
        resp = client_a.get(f"/budgets/{budget.id}")
        assert resp.status_code == 403
        assert "error" in resp.get_json()


# ---------- PATCH /budgets/<id> ----------

class TestUpdate:
    def test_partial_update_keeps_other_fields(self, client_a, session, user_a):
        budget = make_budget(session, user_a)
        make_item(session, budget)

        resp = client_a.patch(f"/budgets/{budget.id}", json={"title": " Renamed "})
        assert resp.status_code == 200
        body = resp.get_json()
        assert set(body) == FULL_KEYS
        assert body["title"] == "Renamed"
        assert body["description"] == "Real numbers"
        assert body["balance_as_of"] == "2026-10-01"
        assert len(body["cash_flow_items"]) == 1

        budget = fresh(session, budget)
        assert budget.title == "Renamed"
        assert budget.description == "Real numbers"

    def test_description_can_be_cleared(self, client_a, session, user_a):
        budget = make_budget(session, user_a)
        resp = client_a.patch(f"/budgets/{budget.id}", json={"description": None})
        assert resp.status_code == 200
        assert fresh(session, budget).description is None

    def test_user_id_in_body_is_ignored(self, client_a, session, user_a, user_b):
        budget = make_budget(session, user_a)
        resp = client_a.patch(f"/budgets/{budget.id}", json={"user_id": user_b.id})
        assert resp.status_code == 200
        assert fresh(session, budget).user_id == user_a.id

    @pytest.mark.parametrize("field, value", [
        ("title", "   "),
        ("title", None),
        ("balance_as_of", "not a date"),
    ])
    def test_bad_body_is_422_and_changes_nothing(self, client_a, session, user_a, field, value):
        budget = make_budget(session, user_a)
        resp = client_a.patch(f"/budgets/{budget.id}", json={"description": "Changed", field: value})
        assert resp.status_code == 422
        assert field in resp.get_json()["errors"]
        budget = fresh(session, budget)
        assert budget.title == "Current"
        assert budget.description == "Real numbers"

    def test_missing_is_404(self, client_a):
        assert client_a.patch("/budgets/9999", json={"title": "X"}).status_code == 404

    def test_someone_elses_is_403_and_changes_nothing(self, client_a, session, user_b):
        budget = make_budget(session, user_b)
        resp = client_a.patch(f"/budgets/{budget.id}", json={"title": "Hacked"})
        assert resp.status_code == 403
        assert fresh(session, budget).title == "Current"

    def test_ownership_is_checked_before_the_body(self, client_a, session, user_b):
        budget = make_budget(session, user_b)
        resp = client_a.patch(f"/budgets/{budget.id}", json={"title": "   "})
        assert resp.status_code == 403


# ---------- DELETE /budgets/<id> ----------

class TestDelete:
    def test_returns_204_and_removes_items_and_assets(self, client_a, session, user_a):
        budget = make_budget(session, user_a)
        keep = make_budget(session, user_a, title="Keep")
        make_item(session, budget)
        make_asset(session, budget)
        make_item(session, keep)

        resp = client_a.delete(f"/budgets/{budget.id}")
        assert resp.status_code == 204
        assert resp.get_data() == b""

        session.expire_all()
        assert [b.id for b in Budget.query.all()] == [keep.id]
        assert CashFlowItem.query.count() == 1
        assert Asset.query.count() == 0

    def test_missing_is_404(self, client_a):
        assert client_a.delete("/budgets/9999").status_code == 404

    def test_someone_elses_is_403_and_deletes_nothing(self, client_a, session, user_b):
        budget = make_budget(session, user_b)
        make_item(session, budget)
        resp = client_a.delete(f"/budgets/{budget.id}")
        assert resp.status_code == 403
        session.expire_all()
        assert Budget.query.count() == 1
        assert CashFlowItem.query.count() == 1

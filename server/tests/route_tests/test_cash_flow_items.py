"""Cash flow item routes (api/cash_flow_items.py): create, update, delete, ownership."""

import json
from datetime import date
from decimal import Decimal

import pytest

from helpers import fresh, make_budget, make_item
from models import CashFlowItem
from schemas import CashFlowItemSchema

INT_OVERFLOW = 2147483648  # one past the largest Postgres Integer


def item_body(**overrides):
    body = {
        "kind": "expense",
        "name": "Rent",
        "amount": "1500.00",
        "start_date": "2026-11-01",
        "interval": 1,
        "unit": "month",
    }
    return {**body, **overrides}


def post_item(client, budget_id, body):
    return client.post(f"/budgets/{budget_id}/cash_flow_items", json=body)


def row(session, item):
    """The item as stored right now, for before/after comparisons."""
    return CashFlowItemSchema().dump(fresh(session, item))


# The item from make_item, as the API returns it
STORED = {
    "kind": "income",
    "name": "Paycheck",
    "amount": "1200.50",
    "start_date": "2026-10-03",
    "end_date": "2027-10-03",
    "interval": 2,
    "unit": "week",
}


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def item(session, budget):
    return make_item(session, budget)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


@pytest.fixture
def their_item(session, their_budget):
    return make_item(session, their_budget)


# ---------- login required ----------

@pytest.mark.parametrize("method, url", [
    ("post", "/budgets/1/cash_flow_items"),
    ("patch", "/cash_flow_items/1"),
    ("delete", "/cash_flow_items/1"),
])
def test_no_session_is_401(client, method, url):
    resp = getattr(client, method)(url, json={})
    assert resp.status_code == 401
    assert "error" in resp.get_json()


def test_no_session_changes_nothing(client, session, item):
    before = row(session, item)
    client.patch(f"/cash_flow_items/{item.id}", json={"name": "Hacked"})
    client.delete(f"/cash_flow_items/{item.id}")
    post_item(client, item.budget_id, item_body())
    assert row(session, item) == before
    assert CashFlowItem.query.count() == 1


# ---------- POST /budgets/<id>/cash_flow_items ----------

class TestCreate:
    def test_recurring_item_returns_201(self, client_a, budget):
        resp = post_item(client_a, budget.id, item_body(end_date="2027-11-01"))
        assert resp.status_code == 201

        saved = CashFlowItem.query.one()
        assert saved.budget_id == budget.id
        assert saved.amount == Decimal("1500.00")
        assert saved.start_date == date(2026, 11, 1)
        assert resp.get_json() == {
            "id": saved.id,
            "kind": "expense",
            "name": "Rent",
            "amount": "1500.00",
            "start_date": "2026-11-01",
            "end_date": "2027-11-01",
            "interval": 1,
            "unit": "month",
        }

    def test_one_time_item_has_no_interval_or_end_date(self, client_a, budget):
        body = item_body(unit="once")
        del body["interval"]
        resp = post_item(client_a, budget.id, body)
        assert resp.status_code == 201
        assert resp.get_json()["interval"] is None
        assert resp.get_json()["end_date"] is None

    @pytest.mark.parametrize("sent, expected", [("1200", "1200.00"), (1200.5, "1200.50")])
    def test_amount_comes_back_as_a_two_place_string(self, client_a, budget, sent, expected):
        resp = post_item(client_a, budget.id, item_body(amount=sent))
        assert resp.get_json()["amount"] == expected

    def test_name_is_stripped(self, client_a, budget):
        resp = post_item(client_a, budget.id, item_body(name="  Rent  "))
        assert resp.get_json()["name"] == "Rent"

    def test_budget_id_comes_from_the_url_not_the_body(self, client_a, budget, their_budget):
        post_item(client_a, budget.id, item_body(budget_id=their_budget.id))
        assert CashFlowItem.query.one().budget_id == budget.id

    def test_shows_up_on_the_budget(self, client_a, budget):
        item_id = post_item(client_a, budget.id, item_body()).get_json()["id"]
        nested = client_a.get(f"/budgets/{budget.id}").get_json()["cash_flow_items"]
        assert [i["id"] for i in nested] == [item_id]

    @pytest.mark.parametrize("field", ["kind", "name", "amount", "start_date", "unit"])
    def test_missing_required_field_is_422(self, client_a, budget, field):
        body = item_body()
        del body[field]
        resp = post_item(client_a, budget.id, body)
        assert resp.status_code == 422
        assert field in resp.get_json()["errors"]
        assert CashFlowItem.query.count() == 0

    @pytest.mark.parametrize("overrides, error_field", [
        ({"kind": "gift"}, "kind"),
        ({"unit": "fortnight"}, "unit"),
        ({"name": "   "}, "name"),            # model ValueError
        ({"amount": "0"}, "amount"),
        ({"amount": "-5.00"}, "amount"),
        ({"amount": "100000000"}, "amount"),
        ({"amount": "lots"}, "amount"),
        ({"start_date": "soon"}, "start_date"),
        ({"interval": 0}, "interval"),
        ({"interval": INT_OVERFLOW}, "interval"),
        ({"interval": None}, "interval"),     # recurring needs one
        ({"unit": "once"}, "interval"),       # one-time can't have one
        ({"end_date": "2026-10-31"}, "end_date"),
    ])
    def test_bad_body_is_422_and_creates_nothing(self, client_a, budget, overrides, error_field):
        resp = post_item(client_a, budget.id, item_body(**overrides))
        assert resp.status_code == 422
        assert error_field in resp.get_json()["errors"]
        assert CashFlowItem.query.count() == 0

    def test_missing_budget_is_404(self, client_a):
        assert post_item(client_a, 9999, item_body()).status_code == 404

    def test_someone_elses_budget_is_403_and_creates_nothing(self, client_a, their_budget):
        assert post_item(client_a, their_budget.id, item_body()).status_code == 403
        assert CashFlowItem.query.count() == 0

    def test_ownership_is_checked_before_the_body(self, client_a, their_budget):
        assert post_item(client_a, their_budget.id, {"kind": "gift"}).status_code == 403


# ---------- PATCH /cash_flow_items/<id> ----------

class TestUpdate:
    def test_partial_update_keeps_other_fields(self, client_a, session, item):
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"name": " Salary "})
        assert resp.status_code == 200
        expected = {**STORED, "id": item.id, "name": "Salary"}
        assert resp.get_json() == expected
        assert row(session, item) == expected

    def test_amount_can_change(self, client_a, session, item):
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"amount": "99.5"})
        assert resp.get_json()["amount"] == "99.50"
        assert fresh(session, item).amount == Decimal("99.50")

    def test_unit_change_uses_the_stored_interval(self, client_a, session, item):
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"unit": "month"})
        assert resp.status_code == 200
        assert resp.get_json()["interval"] == 2
        assert fresh(session, item).unit == "month"

    def test_recurring_becomes_one_time_when_interval_is_cleared_too(self, client_a, session, item):
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"unit": "once", "interval": None})
        assert resp.status_code == 200
        item = fresh(session, item)
        assert item.unit == "once"
        assert item.interval is None

    def test_one_time_becomes_recurring_only_with_an_interval(self, client_a, session, budget):
        once = CashFlowItem(budget=budget, kind="expense", name="Fee", amount=Decimal("5.00"),
                            start_date=date(2026, 11, 1), unit="once")
        session.add(once)
        session.commit()

        resp = client_a.patch(f"/cash_flow_items/{once.id}", json={"unit": "week"})
        assert resp.status_code == 422
        assert "interval" in resp.get_json()["errors"]
        assert fresh(session, once).unit == "once"

        resp = client_a.patch(f"/cash_flow_items/{once.id}", json={"unit": "week", "interval": 1})
        assert resp.status_code == 200

    def test_end_date_can_be_cleared(self, client_a, session, item):
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"end_date": None})
        assert resp.status_code == 200
        assert fresh(session, item).end_date is None

    @pytest.mark.parametrize("bad, error_field", [
        ({"unit": "once"}, "interval"),                # stored interval is 2
        ({"interval": None}, "interval"),              # stored unit is week
        ({"interval": 0}, "interval"),
        ({"interval": INT_OVERFLOW}, "interval"),
        ({"end_date": "2026-01-01"}, "end_date"),      # before stored start_date
        ({"start_date": "2028-01-01"}, "end_date"),    # after stored end_date
        ({"amount": "0"}, "amount"),
        ({"amount": "100000000"}, "amount"),
        ({"kind": "gift"}, "kind"),
        ({"unit": "fortnight"}, "unit"),
        ({"name": "   "}, "name"),
        ({"name": None}, "name"),
        ({"start_date": None}, "start_date"),
    ])
    def test_bad_body_is_422_and_changes_nothing(self, client_a, session, item, bad, error_field):
        before = row(session, item)
        # the valid "kind" change must not be saved either
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"kind": "expense", **bad})
        assert resp.status_code == 422
        assert error_field in resp.get_json()["errors"]
        assert row(session, item) == before

    @pytest.mark.parametrize("body", [[1], "text", 5, None])
    def test_body_that_is_not_an_object_is_422(self, client_a, session, item, body):
        before = row(session, item)
        resp = client_a.patch(f"/cash_flow_items/{item.id}", data=json.dumps(body), content_type="application/json")
        assert resp.status_code == 422
        assert "errors" in resp.get_json()
        assert row(session, item) == before

    def test_budget_id_in_body_cannot_move_the_item(self, client_a, session, item, budget, their_budget):
        resp = client_a.patch(f"/cash_flow_items/{item.id}", json={"budget_id": their_budget.id})
        assert resp.status_code == 200
        assert fresh(session, item).budget_id == budget.id
        assert session.get(type(their_budget), their_budget.id).cash_flow_items == []

    def test_id_in_body_is_ignored(self, client_a, session, item):
        original_id = item.id
        resp = client_a.patch(f"/cash_flow_items/{original_id}", json={"id": original_id + 1, "name": "Salary"})
        assert resp.status_code == 200
        assert resp.get_json()["id"] == original_id

    def test_missing_is_404(self, client_a):
        assert client_a.patch("/cash_flow_items/9999", json={"name": "X"}).status_code == 404

    def test_someone_elses_is_403_and_changes_nothing(self, client_a, session, their_item):
        before = row(session, their_item)
        resp = client_a.patch(f"/cash_flow_items/{their_item.id}", json={"name": "Hacked"})
        assert resp.status_code == 403
        assert "error" in resp.get_json()
        assert row(session, their_item) == before

    def test_ownership_is_checked_before_the_body(self, client_a, their_item):
        resp = client_a.patch(f"/cash_flow_items/{their_item.id}", json={"amount": "0"})
        assert resp.status_code == 403


# ---------- DELETE /cash_flow_items/<id> ----------

class TestDelete:
    def test_returns_204_and_removes_only_that_item(self, client_a, session, budget, item):
        keep = make_item(session, budget, name="Keep")
        resp = client_a.delete(f"/cash_flow_items/{item.id}")
        assert resp.status_code == 204
        assert resp.get_data() == b""
        session.expire_all()
        assert [i.id for i in CashFlowItem.query.all()] == [keep.id]
        assert fresh(session, budget) is not None

    def test_missing_is_404(self, client_a):
        assert client_a.delete("/cash_flow_items/9999").status_code == 404

    def test_someone_elses_is_403_and_deletes_nothing(self, client_a, session, their_item):
        resp = client_a.delete(f"/cash_flow_items/{their_item.id}")
        assert resp.status_code == 403
        session.expire_all()
        assert CashFlowItem.query.count() == 1

"""Projection routes (api/projections.py): timeline and monthly."""

from datetime import date
from decimal import Decimal

import pytest
from dateutil.relativedelta import relativedelta

from helpers import make_budget
from models import CashFlowItem

ENDPOINTS = ["timeline", "monthly"]


def add_item(session, budget, name="Item", kind="expense", amount="100.00",
             start=date(2026, 11, 10), end=None, interval=None, unit="once"):
    item = CashFlowItem(budget=budget, kind=kind, name=name, amount=Decimal(amount),
                        start_date=start, end_date=end, interval=interval, unit=unit)
    session.add(item)
    session.commit()
    return item


def default_window():
    first = date.today().replace(day=1)
    return first, first + relativedelta(months=6, days=-1)


def get_timeline(client, budget, **params):
    return client.get(f"/budgets/{budget.id}/timeline", query_string=params)


def get_monthly(client, budget, **params):
    return client.get(f"/budgets/{budget.id}/monthly", query_string=params)


def names(resp):
    return [e["name"] for e in resp.get_json()]


def row(resp, month):
    return next(r for r in resp.get_json() if r["month"] == month)


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


# ---------- access rules (both endpoints) ----------

@pytest.mark.parametrize("endpoint", ENDPOINTS)
class TestAccess:
    def test_no_session_is_401(self, client, budget, endpoint):
        resp = client.get(f"/budgets/{budget.id}/{endpoint}")
        assert resp.status_code == 401
        assert "error" in resp.get_json()

    def test_missing_budget_is_404(self, client_a, endpoint):
        resp = client_a.get(f"/budgets/999999/{endpoint}")
        assert resp.status_code == 404
        assert "error" in resp.get_json()

    def test_another_users_budget_is_403(self, client_a, their_budget, endpoint):
        resp = client_a.get(f"/budgets/{their_budget.id}/{endpoint}")
        assert resp.status_code == 403
        assert "error" in resp.get_json()

    def test_ownership_is_checked_before_the_params(self, client_a, their_budget, endpoint):
        resp = client_a.get(f"/budgets/{their_budget.id}/{endpoint}", query_string={"start": "nope"})
        assert resp.status_code == 403

    def test_unknown_params_are_ignored(self, client_a, budget, endpoint):
        resp = client_a.get(f"/budgets/{budget.id}/{endpoint}", query_string={"colour": "red"})
        assert resp.status_code == 200


# ---------- error shape: {"errors": {param: [messages]}} ----------

@pytest.mark.parametrize("endpoint, param, params", [
    ("timeline", "start", {"start": "nope"}),
    ("timeline", "start", {"start": "1899-12-31"}),
    ("timeline", "end", {"start": "2026-11-02", "end": "2026-11-01"}),
    ("monthly", "start", {"start": "nope"}),
    ("monthly", "start", {"start": "1899-12"}),
    ("monthly", "months", {"months": "abc"}),
    ("monthly", "months", {"months": "0"}),
])
def test_param_errors_are_lists_of_messages(client_a, budget, endpoint, param, params):
    resp = client_a.get(f"/budgets/{budget.id}/{endpoint}", query_string=params)
    assert resp.status_code == 422
    messages = resp.get_json()["errors"][param]
    assert isinstance(messages, list) and messages


# ---------- GET /budgets/<id>/timeline ----------

class TestTimeline:
    def test_returns_entries_with_string_amounts_and_dates(self, client_a, session, budget):
        item = add_item(session, budget, name="Rent", amount="1450.5", start=date(2026, 11, 1),
                        interval=1, unit="month")
        resp = get_timeline(client_a, budget, start="2026-11-01", end="2026-12-31")
        assert resp.status_code == 200
        assert resp.get_json() == [
            {"item_id": item.id, "name": "Rent", "kind": "expense", "amount": "1450.50", "date": "2026-11-01"},
            {"item_id": item.id, "name": "Rent", "kind": "expense", "amount": "1450.50", "date": "2026-12-01"},
        ]

    def test_sorted_by_date_then_name(self, client_a, session, budget):
        add_item(session, budget, name="Late", start=date(2026, 11, 20))
        add_item(session, budget, name="Beta", start=date(2026, 11, 5))
        add_item(session, budget, name="Alpha", start=date(2026, 11, 5))
        resp = get_timeline(client_a, budget, start="2026-11-01", end="2026-11-30")
        assert names(resp) == ["Alpha", "Beta", "Late"]

    def test_window_includes_both_ends(self, client_a, session, budget):
        add_item(session, budget, name="Before", start=date(2026, 10, 31))
        add_item(session, budget, name="First", start=date(2026, 11, 1))
        add_item(session, budget, name="Last", start=date(2026, 11, 30))
        add_item(session, budget, name="After", start=date(2026, 12, 1))
        resp = get_timeline(client_a, budget, start="2026-11-01", end="2026-11-30")
        assert names(resp) == ["First", "Last"]

    def test_only_this_budgets_items(self, client_a, session, budget, their_budget):
        add_item(session, budget, name="Mine")
        add_item(session, their_budget, name="Theirs")
        resp = get_timeline(client_a, budget, start="2026-11-01", end="2026-11-30")
        assert names(resp) == ["Mine"]

    def test_empty_budget_is_an_empty_list(self, client_a, budget):
        resp = get_timeline(client_a, budget)
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_default_window_is_this_month_plus_the_next_five(self, client_a, session, budget):
        first, last = default_window()
        add_item(session, budget, name="Before", start=first - relativedelta(days=1))
        add_item(session, budget, name="First", start=first)
        add_item(session, budget, name="Last", start=last)
        add_item(session, budget, name="After", start=last + relativedelta(days=1))
        resp = get_timeline(client_a, budget)
        assert names(resp) == ["First", "Last"]

    def test_only_start_falls_back_to_the_default_end(self, client_a, session, budget):
        first, last = default_window()
        add_item(session, budget, name="Early", start=first - relativedelta(months=2))
        add_item(session, budget, name="Last", start=last)
        add_item(session, budget, name="After", start=last + relativedelta(days=1))
        resp = get_timeline(client_a, budget, start=(first - relativedelta(months=3)).isoformat())
        assert names(resp) == ["Early", "Last"]

    def test_only_end_falls_back_to_the_default_start(self, client_a, session, budget):
        first, last = default_window()
        add_item(session, budget, name="Before", start=first - relativedelta(days=1))
        add_item(session, budget, name="First", start=first)
        add_item(session, budget, name="Late", start=last + relativedelta(months=2))
        resp = get_timeline(client_a, budget, end=(last + relativedelta(months=3)).isoformat())
        assert names(resp) == ["First", "Late"]

    def test_end_before_start_is_422_on_end(self, client_a, budget):
        resp = get_timeline(client_a, budget, start="2026-11-02", end="2026-11-01")
        assert resp.status_code == 422
        assert "end" in resp.get_json()["errors"]

    def test_end_equal_to_start_is_allowed(self, client_a, session, budget):
        add_item(session, budget, name="Today", start=date(2026, 11, 2))
        resp = get_timeline(client_a, budget, start="2026-11-02", end="2026-11-02")
        assert resp.status_code == 200
        assert names(resp) == ["Today"]

    @pytest.mark.parametrize("param", ["start", "end"])
    @pytest.mark.parametrize("value", ["nope", "2026-13-01", "2026-02-30", ""])
    def test_bad_date_is_422_on_that_param(self, client_a, budget, param, value):
        resp = get_timeline(client_a, budget, **{param: value})
        assert resp.status_code == 422
        assert param in resp.get_json()["errors"]

    @pytest.mark.parametrize("param, value", [
        ("start", "1899-12-31"),
        ("start", "2201-01-01"),
        ("end", "1899-12-31"),
        ("end", "2201-01-01"),
        ("end", "9999-12-31"),
    ])
    def test_date_outside_the_allowed_years_is_422(self, client_a, budget, param, value):
        resp = get_timeline(client_a, budget, **{param: value})
        assert resp.status_code == 422
        assert param in resp.get_json()["errors"]

    def test_widest_allowed_window_works(self, client_a, session, budget):
        add_item(session, budget, name="Rare", start=date(2026, 1, 1), interval=999, unit="year")
        resp = get_timeline(client_a, budget, start="1900-01-01", end="2200-12-31")
        assert resp.status_code == 200
        assert names(resp) == ["Rare"]


# ---------- GET /budgets/<id>/monthly ----------

class TestMonthly:
    def test_default_is_six_rows_starting_this_month(self, client_a, budget):
        first, _ = default_window()
        resp = get_monthly(client_a, budget)
        assert resp.status_code == 200
        assert [r["month"] for r in resp.get_json()] == [
            (first + relativedelta(months=m)).strftime("%Y-%m") for m in range(6)
        ]

    def test_empty_budget_rows_are_string_zeros(self, client_a, budget):
        for r in get_monthly(client_a, budget).get_json():
            assert (r["income"], r["expenses"], r["net"]) == ("0.00", "0.00", "0.00")

    def test_row_totals_are_strings_with_two_places(self, client_a, session, budget):
        add_item(session, budget, kind="income", amount="1000", start=date(2026, 11, 3))
        add_item(session, budget, kind="expense", amount="250.5", start=date(2026, 11, 4))
        add_item(session, budget, kind="expense", amount="10.25", start=date(2026, 11, 5))
        resp = get_monthly(client_a, budget, start="2026-11", months=1)
        assert resp.get_json() == [
            {"month": "2026-11", "income": "1000.00", "expenses": "260.75", "net": "739.25"},
        ]

    def test_net_can_be_negative(self, client_a, session, budget):
        add_item(session, budget, kind="expense", amount="75.10", start=date(2026, 11, 3))
        resp = get_monthly(client_a, budget, start="2026-11", months=1)
        assert resp.get_json()[0]["net"] == "-75.10"

    def test_covers_all_of_the_first_and_last_months(self, client_a, session, budget):
        add_item(session, budget, amount="1.00", start=date(2026, 10, 31))
        add_item(session, budget, amount="2.00", start=date(2026, 11, 1))
        add_item(session, budget, amount="4.00", start=date(2026, 12, 31))
        add_item(session, budget, amount="8.00", start=date(2027, 1, 1))
        resp = get_monthly(client_a, budget, start="2026-11", months=2)
        assert [r["month"] for r in resp.get_json()] == ["2026-11", "2026-12"]
        assert row(resp, "2026-11")["expenses"] == "2.00"
        assert row(resp, "2026-12")["expenses"] == "4.00"

    def test_default_window_covers_all_of_the_last_month(self, client_a, session, budget):
        _, last = default_window()
        add_item(session, budget, amount="9.00", start=last)
        resp = get_monthly(client_a, budget)
        assert resp.get_json()[-1]["expenses"] == "9.00"

    def test_month_end_item_lands_in_february(self, client_a, session, budget):
        add_item(session, budget, amount="10.00", start=date(2027, 1, 31), interval=1, unit="month")
        resp = get_monthly(client_a, budget, start="2027-01", months=3)
        assert [r["expenses"] for r in resp.get_json()] == ["10.00", "10.00", "10.00"]

    def test_only_this_budgets_items(self, client_a, session, budget, their_budget):
        add_item(session, their_budget, amount="5.00", start=date(2026, 11, 3))
        resp = get_monthly(client_a, budget, start="2026-11", months=1)
        assert resp.get_json()[0]["expenses"] == "0.00"

    def test_start_alone_defaults_to_six_months(self, client_a, budget):
        resp = get_monthly(client_a, budget, start="2026-11")
        rows = resp.get_json()
        assert len(rows) == 6
        assert (rows[0]["month"], rows[-1]["month"]) == ("2026-11", "2027-04")

    def test_months_alone_starts_this_month(self, client_a, budget):
        first, _ = default_window()
        rows = get_monthly(client_a, budget, months=2).get_json()
        assert [r["month"] for r in rows] == [
            first.strftime("%Y-%m"), (first + relativedelta(months=1)).strftime("%Y-%m"),
        ]

    @pytest.mark.parametrize("months", [1, 24])
    def test_months_limits_are_allowed(self, client_a, budget, months):
        resp = get_monthly(client_a, budget, months=months)
        assert resp.status_code == 200
        assert len(resp.get_json()) == months

    @pytest.mark.parametrize("months", ["abc", "0", "25", "-1", "6.5", ""])
    def test_bad_months_is_422(self, client_a, budget, months):
        resp = get_monthly(client_a, budget, months=months)
        assert resp.status_code == 422
        assert "months" in resp.get_json()["errors"]

    @pytest.mark.parametrize("start", ["nope", "2026-13", "2026-00", "2026-11-05", ""])
    def test_bad_start_is_422(self, client_a, budget, start):
        resp = get_monthly(client_a, budget, start=start)
        assert resp.status_code == 422
        assert "start" in resp.get_json()["errors"]

    @pytest.mark.parametrize("start", ["1899-12", "2201-01", "9999-12"])
    def test_start_outside_the_allowed_years_is_422(self, client_a, budget, start):
        resp = get_monthly(client_a, budget, start=start, months=1)
        assert resp.status_code == 422
        assert "start" in resp.get_json()["errors"]

    @pytest.mark.parametrize("start", ["1900-01", "2200-12"])
    def test_allowed_year_limits_work_with_the_longest_window(self, client_a, session, budget, start):
        add_item(session, budget, start=date(2026, 1, 1), interval=999, unit="year")
        resp = get_monthly(client_a, budget, start=start, months=24)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 24

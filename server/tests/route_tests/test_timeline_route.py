"""GET /budgets/<id>/timeline (api/projections.py)."""

from datetime import date

import pytest
from dateutil.relativedelta import relativedelta

from helpers import add_item, default_window, make_budget


def get_timeline(client, budget, **params):
    return client.get(f"/budgets/{budget.id}/timeline", query_string=params)


def names(resp):
    return [e["name"] for e in resp.get_json()]


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


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

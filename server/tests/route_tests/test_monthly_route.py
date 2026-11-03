"""GET /budgets/<id>/monthly (api/projections.py)."""

from datetime import date

import pytest
from dateutil.relativedelta import relativedelta

from helpers import add_item, default_window, make_budget


def get_monthly(client, budget, **params):
    return client.get(f"/budgets/{budget.id}/monthly", query_string=params)


def row(resp, month):
    return next(r for r in resp.get_json() if r["month"] == month)


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


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

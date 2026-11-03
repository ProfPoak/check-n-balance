"""GET /budgets/<id>/projection (api/projections.py)."""

from datetime import date

import pytest

from helpers import add_asset, add_item, fresh, make_budget


def get_projection(client, budget, **params):
    return client.get(f"/budgets/{budget.id}/projection", query_string=params)


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


# ---------- GET /budgets/<id>/projection ----------
# make_budget sets balance_as_of to 2026-10-01

class TestProjection:
    def test_returns_every_field_as_a_string(self, client_a, session, budget):
        add_asset(session, budget, balance="1000.5")
        add_item(session, budget, kind="income", amount="300", start=date(2026, 10, 5))
        add_item(session, budget, kind="expense", amount="50.25", start=date(2026, 10, 6))
        resp = get_projection(client_a, budget, to="2026-10-31")
        assert resp.status_code == 200
        assert resp.get_json() == {
            "as_of": "2026-10-01",
            "to": "2026-10-31",
            "starting_balance": "1000.50",
            "income": "300.00",
            "expenses": "50.25",
            "net": "249.75",
            "projected_balance": "1250.25",
        }

    def test_empty_budget_is_all_zeros(self, client_a, budget):
        resp = get_projection(client_a, budget, to="2026-12-31")
        assert resp.status_code == 200
        assert resp.get_json() == {
            "as_of": "2026-10-01",
            "to": "2026-12-31",
            "starting_balance": "0.00",
            "income": "0.00",
            "expenses": "0.00",
            "net": "0.00",
            "projected_balance": "0.00",
        }

    def test_starting_balance_sums_all_assets_including_negatives(self, client_a, session, budget):
        add_asset(session, budget, name="Checking", balance="2500.00")
        add_asset(session, budget, name="Savings", balance="8000.00")
        add_asset(session, budget, name="Loan", balance="-1500.50")
        data = get_projection(client_a, budget, to="2026-10-31").get_json()
        assert data["starting_balance"] == "8999.50"
        assert data["projected_balance"] == "8999.50"

    def test_items_with_no_assets_start_from_zero(self, client_a, session, budget):
        add_item(session, budget, kind="income", amount="75.00", start=date(2026, 10, 5))
        data = get_projection(client_a, budget, to="2026-10-31").get_json()
        assert data["starting_balance"] == "0.00"
        assert data["projected_balance"] == "75.00"

    def test_as_of_is_excluded_and_to_is_included(self, client_a, session, budget):
        add_item(session, budget, amount="1.00", start=date(2026, 9, 30))
        add_item(session, budget, amount="2.00", start=date(2026, 10, 1))
        add_item(session, budget, amount="4.00", start=date(2026, 10, 2))
        add_item(session, budget, amount="8.00", start=date(2026, 10, 31))
        add_item(session, budget, amount="16.00", start=date(2026, 11, 1))
        data = get_projection(client_a, budget, to="2026-10-31").get_json()
        assert data["expenses"] == "12.00"

    def test_recurring_item_counts_only_occurrences_in_the_window(self, client_a, session, budget):
        # Every 2 weeks from Sep 1: Sep 1, 15, 29 are too early; Oct 13, Oct 27, Nov 10 count; Nov 24 is too late
        add_item(session, budget, kind="income", amount="100.00", start=date(2026, 9, 1),
                 interval=2, unit="week")
        data = get_projection(client_a, budget, to="2026-11-10").get_json()
        assert data["income"] == "300.00"

    def test_item_end_date_is_respected(self, client_a, session, budget):
        add_item(session, budget, amount="10.00", start=date(2026, 10, 15),
                 end=date(2026, 11, 15), interval=1, unit="month")
        data = get_projection(client_a, budget, to="2027-03-31").get_json()
        assert data["expenses"] == "20.00"

    def test_net_and_projected_can_be_negative(self, client_a, session, budget):
        add_asset(session, budget, balance="100.00")
        add_item(session, budget, amount="250.10", start=date(2026, 10, 5))
        data = get_projection(client_a, budget, to="2026-10-31").get_json()
        assert data["net"] == "-250.10"
        assert data["projected_balance"] == "-150.10"

    def test_only_this_budgets_items_and_assets(self, client_a, session, budget, their_budget):
        add_asset(session, their_budget, balance="999.00")
        add_item(session, their_budget, amount="5.00", start=date(2026, 10, 5))
        data = get_projection(client_a, budget, to="2026-10-31").get_json()
        assert data["starting_balance"] == "0.00"
        assert data["expenses"] == "0.00"

    def test_window_follows_the_stored_balance_as_of(self, client_a, session, budget):
        add_item(session, budget, amount="10.00", start=date(2026, 10, 15))
        assert get_projection(client_a, budget, to="2026-10-31").get_json()["expenses"] == "10.00"
        fresh(session, budget).balance_as_of = date(2026, 10, 20)
        session.commit()
        data = get_projection(client_a, budget, to="2026-10-31").get_json()
        assert data["as_of"] == "2026-10-20"
        assert data["expenses"] == "0.00"

    def test_to_equal_to_as_of_has_zero_net(self, client_a, session, budget):
        add_asset(session, budget, balance="500.00")
        add_item(session, budget, amount="10.00", start=date(2026, 10, 1))
        resp = get_projection(client_a, budget, to="2026-10-01")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["net"] == "0.00"
        assert data["projected_balance"] == "500.00"

    def test_to_before_as_of_is_422(self, client_a, budget):
        resp = get_projection(client_a, budget, to="2026-09-30")
        assert resp.status_code == 422
        assert "to" in resp.get_json()["errors"]

    def test_missing_to_is_422(self, client_a, budget):
        resp = get_projection(client_a, budget)
        assert resp.status_code == 422
        assert "to" in resp.get_json()["errors"]

    @pytest.mark.parametrize("value", ["nope", "2026-13-01", "2026-02-30", "", "1899-12-31", "2201-01-01", "9999-12-31"])
    def test_bad_to_is_422(self, client_a, budget, value):
        resp = get_projection(client_a, budget, to=value)
        assert resp.status_code == 422
        assert "to" in resp.get_json()["errors"]

    def test_latest_allowed_to_works(self, client_a, session, budget):
        add_item(session, budget, amount="10.00", start=date(2026, 10, 15), interval=999, unit="year")
        resp = get_projection(client_a, budget, to="2200-12-31")
        assert resp.status_code == 200
        assert resp.get_json()["expenses"] == "10.00"

    def test_balance_as_of_at_the_largest_date_is_422_not_a_crash(self, client_a, session, budget):
        fresh(session, budget).balance_as_of = date(9999, 12, 31)
        session.commit()
        resp = get_projection(client_a, budget, to="2200-12-31")
        assert resp.status_code == 422
        assert "to" in resp.get_json()["errors"]

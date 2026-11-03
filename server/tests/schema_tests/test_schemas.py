"""Marshmallow schemas: shape, allowed values, money ranges, cross-field rules, and dump format."""

from datetime import date
from decimal import Decimal

import pytest
from marshmallow import ValidationError

from schemas import AssetSchema, BudgetSchema, CashFlowItemSchema, UserSchema
from helpers import make_asset, make_budget, make_item, make_user


def errors_for(schema, data, **kwargs):
    """Load data that should fail; return the error dict."""
    with pytest.raises(ValidationError) as exc:
        schema.load(data, **kwargs)
    return exc.value.messages


def item_body(**overrides):
    body = {
        "kind": "income", "name": "Paycheck", "amount": "1200.50",
        "start_date": "2026-10-02", "end_date": "2027-10-02",
        "interval": 2, "unit": "week",
    }
    body.update(overrides)
    return body


# ---------- UserSchema ----------

class TestUserSchema:
    def test_dumps_only_id_and_email(self, session):
        user = make_user(session)
        assert UserSchema().dump(user) == {"id": user.id, "email": "pat@example.com"}

    def test_password_is_load_only(self):
        assert "password" not in UserSchema().dump({"id": 1, "email": "pat@example.com", "password": "secret123"})

    def test_loads_email_and_password(self):
        body = {"email": "pat@example.com", "password": "password123"}
        assert UserSchema().load(body) == body

    @pytest.mark.parametrize("missing", ["email", "password"])
    def test_email_and_password_are_required(self, missing):
        body = {"email": "pat@example.com", "password": "password123"}
        del body[missing]
        assert missing in errors_for(UserSchema(), body)

    def test_unknown_and_dump_only_keys_are_dropped(self):
        body = {"email": "pat@example.com", "password": "password123", "id": 99, "is_admin": True}
        assert UserSchema().load(body) == {"email": "pat@example.com", "password": "password123"}


# ---------- BudgetSchema ----------

class TestBudgetSchema:
    def test_empty_body_loads_as_empty_dict(self):
        # Nothing injected, so the model defaults (title, balance_as_of) apply
        assert BudgetSchema().load({}) == {}

    def test_loads_all_fields(self):
        data = BudgetSchema().load({"title": "Current", "description": "Real numbers", "balance_as_of": "2026-10-01"})
        assert data == {"title": "Current", "description": "Real numbers", "balance_as_of": date(2026, 10, 1)}

    def test_bad_date_is_an_error(self):
        assert "balance_as_of" in errors_for(BudgetSchema(), {"balance_as_of": "2026-13-01"})

    def test_id_user_id_and_nested_lists_are_not_loaded(self):
        body = {"title": "Current", "id": 5, "user_id": 2, "cash_flow_items": [], "assets": []}
        assert BudgetSchema().load(body) == {"title": "Current"}

    def test_dump_has_fields_and_nested_items_and_assets(self, session):
        budget = make_budget(session, make_user(session))
        item = make_item(session, budget)
        asset = make_asset(session, budget)
        out = BudgetSchema().dump(budget)
        assert out["id"] == budget.id
        assert out["title"] == "Current"
        assert out["description"] == "Real numbers"
        assert out["balance_as_of"] == "2026-10-01"
        assert [i["id"] for i in out["cash_flow_items"]] == [item.id]
        assert out["cash_flow_items"][0]["amount"] == "1200.50"
        assert [a["id"] for a in out["assets"]] == [asset.id]
        assert out["assets"][0]["balance"] == "2500.00"


# ---------- CashFlowItemSchema ----------

class TestCashFlowItemSchema:
    def test_loads_a_full_body_with_python_types(self):
        assert CashFlowItemSchema().load(item_body()) == {
            "kind": "income", "name": "Paycheck", "amount": Decimal("1200.50"),
            "start_date": date(2026, 10, 2), "end_date": date(2027, 10, 2),
            "interval": 2, "unit": "week",
        }

    def test_dump_format(self, session):
        item = make_item(session, make_budget(session, make_user(session)))
        out = CashFlowItemSchema().dump(item)
        assert out["id"] == item.id
        assert out["amount"] == "1200.50"
        assert out["start_date"] == "2026-10-03"
        assert out["end_date"] == "2027-10-03"
        assert (out["kind"], out["name"], out["interval"], out["unit"]) == ("income", "Paycheck", 2, "week")

    @pytest.mark.parametrize("missing", ["kind", "name", "amount", "start_date", "unit"])
    def test_required_fields(self, missing):
        body = item_body()
        del body[missing]
        assert missing in errors_for(CashFlowItemSchema(), body)

    def test_end_date_is_optional_and_may_be_null(self):
        body = item_body()
        del body["end_date"]
        assert "end_date" not in CashFlowItemSchema().load(body)
        assert CashFlowItemSchema().load(item_body(end_date=None))["end_date"] is None

    def test_bad_kind_and_unit(self):
        errors = errors_for(CashFlowItemSchema(), item_body(kind="gift", unit="fortnight"))
        assert "kind" in errors and "unit" in errors

    @pytest.mark.parametrize("amount", ["0", "-5.00", "100000000", "abc"])
    def test_bad_amounts(self, amount):
        assert "amount" in errors_for(CashFlowItemSchema(), item_body(amount=amount))

    def test_largest_amount_that_fits_numeric_10_2(self):
        assert CashFlowItemSchema().load(item_body(amount="99999999.99"))["amount"] == Decimal("99999999.99")

    def test_extra_decimals_are_rounded(self):
        assert CashFlowItemSchema().load(item_body(amount="19.999"))["amount"] == Decimal("20.00")

    def test_interval_below_one_is_an_error(self):
        assert "interval" in errors_for(CashFlowItemSchema(), item_body(interval=0))

    def test_once_without_interval_or_with_null_interval_loads(self):
        body = item_body(unit="once")
        del body["interval"]
        assert CashFlowItemSchema().load(body).get("interval") is None
        assert CashFlowItemSchema().load(item_body(unit="once", interval=None))["interval"] is None

    def test_once_with_an_interval_is_an_error(self):
        assert "interval" in errors_for(CashFlowItemSchema(), item_body(unit="once", interval=2))

    def test_recurring_without_interval_is_an_error(self):
        body = item_body(unit="month")
        del body["interval"]
        assert "interval" in errors_for(CashFlowItemSchema(), body)
        assert "interval" in errors_for(CashFlowItemSchema(), item_body(unit="month", interval=None))

    def test_end_date_before_start_date_is_an_error(self):
        errors = errors_for(CashFlowItemSchema(), item_body(start_date="2026-10-02", end_date="2026-10-01"))
        assert "end_date" in errors

    def test_end_date_on_start_date_is_fine(self):
        data = CashFlowItemSchema().load(item_body(start_date="2026-10-02", end_date="2026-10-02"))
        assert data["end_date"] == date(2026, 10, 2)

    def test_partial_load_skips_cross_field_rules_for_missing_fields(self):
        # Day 4 PATCH sends only the changed fields
        assert CashFlowItemSchema().load({"amount": "5.00"}, partial=True) == {"amount": Decimal("5.00")}
        assert CashFlowItemSchema().load({"end_date": "2026-01-01"}, partial=True) == {"end_date": date(2026, 1, 1)}

    def test_id_and_budget_id_are_not_loaded(self):
        data = CashFlowItemSchema().load(item_body(id=9, budget_id=3))
        assert "id" not in data and "budget_id" not in data


# ---------- AssetSchema ----------

class TestAssetSchema:
    def test_loads_name_and_balance(self):
        assert AssetSchema().load({"name": "Checking", "balance": "2500.00"}) == {
            "name": "Checking", "balance": Decimal("2500.00"),
        }

    def test_dump_format(self, session):
        asset = make_asset(session, make_budget(session, make_user(session)))
        assert AssetSchema().dump(asset) == {"id": asset.id, "name": "Checking", "balance": "2500.00"}

    @pytest.mark.parametrize("missing", ["name", "balance"])
    def test_required_fields(self, missing):
        body = {"name": "Checking", "balance": "2500.00"}
        del body[missing]
        assert missing in errors_for(AssetSchema(), body)

    @pytest.mark.parametrize("balance", ["-15000.00", "0", "99999999.99", "-99999999.99"])
    def test_balances_in_range_load(self, balance):
        assert AssetSchema().load({"name": "Loan", "balance": balance})["balance"] == Decimal(balance)

    @pytest.mark.parametrize("balance", ["100000000", "-100000000", "abc"])
    def test_balances_out_of_range_are_errors(self, balance):
        assert "balance" in errors_for(AssetSchema(), {"name": "Loan", "balance": balance})

    def test_id_and_budget_id_are_not_loaded(self):
        data = AssetSchema().load({"name": "Checking", "balance": "1.00", "id": 4, "budget_id": 3})
        assert data == {"name": "Checking", "balance": Decimal("1.00")}

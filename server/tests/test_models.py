"""Day 1 Block C: columns, relationships, and password handling.

Validations live in one file per model: test_user_validations.py, test_budget_validations.py, ...
"""

import ast
import pathlib
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import Date, Integer, Numeric, String, Text, inspect
from sqlalchemy.exc import IntegrityError

from helpers import column, fk_target, make_asset, make_budget, make_item, make_user
from models import Asset, Budget, CashFlowItem, User

MODELS_DIR = pathlib.Path(__file__).resolve().parent.parent / "models"


# --- Package layout -------------------------------------------------------


class TestPackageLayout:
    def test_each_model_has_its_own_file(self):
        for filename in ("user.py", "budget.py", "cash_flow_item.py", "asset.py"):
            assert (MODELS_DIR / filename).is_file(), f"missing models/{filename}"

    def test_models_come_from_their_own_modules(self):
        assert User.__module__ == "models.user"
        assert Budget.__module__ == "models.budget"
        assert CashFlowItem.__module__ == "models.cash_flow_item"
        assert Asset.__module__ == "models.asset"

    @pytest.mark.parametrize("filename", ["user.py", "budget.py", "cash_flow_item.py", "asset.py"])
    def test_model_files_do_not_import_each_other(self, filename):
        tree = ast.parse((MODELS_DIR / filename).read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                assert node.level == 0, f"{filename} has a relative import (from .{module})"
                assert not module.startswith("models"), f"{filename} imports from {module}"
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    assert not alias.name.startswith("models"), f"{filename} imports {alias.name}"


# --- Tables and columns ---------------------------------------------------


class TestTables:
    def test_table_names(self):
        assert User.__tablename__ == "users"
        assert Budget.__tablename__ == "budgets"
        assert CashFlowItem.__tablename__ == "cash_flow_items"
        assert Asset.__tablename__ == "assets"

    def test_all_tables_exist_in_the_database(self, session):
        names = set(inspect(session.get_bind()).get_table_names())
        assert {"users", "budgets", "cash_flow_items", "assets"} <= names


class TestUserColumns:
    def test_columns_match_the_diagram(self):
        assert set(User.__table__.columns.keys()) == {"id", "email", "password_hash"}

    def test_id_is_integer_primary_key(self):
        assert column(User, "id").primary_key
        assert isinstance(column(User, "id").type, Integer)

    def test_email_is_a_unique_string(self):
        assert isinstance(column(User, "email").type, String)
        assert column(User, "email").unique

    def test_password_hash_column_is_mapped_to_underscore_attribute(self):
        assert User._password_hash.property.columns[0].name == "password_hash"

    def test_password_hash_has_no_length_limit(self):
        # Werkzeug's scrypt hashes are ~160 characters; String(128) would cut them off
        assert column(User, "password_hash").type.length is None

    def test_duplicate_email_is_rejected_by_the_database(self, session):
        make_user(session, email="pat@example.com")
        session.add(User(email="pat@example.com", _password_hash="x"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


class TestBudgetColumns:
    def test_columns_match_the_diagram(self):
        assert set(Budget.__table__.columns.keys()) == {"id", "user_id", "title", "description", "balance_as_of"}

    def test_types(self):
        assert isinstance(column(Budget, "title").type, String)
        assert isinstance(column(Budget, "description").type, Text)
        assert isinstance(column(Budget, "balance_as_of").type, Date)

    def test_user_id_references_users(self):
        assert fk_target(Budget, "user_id") == "users.id"


class TestCashFlowItemColumns:
    def test_columns_match_the_diagram(self):
        assert set(CashFlowItem.__table__.columns.keys()) == {
            "id", "budget_id", "kind", "name", "amount", "start_date", "end_date", "interval", "unit",
        }

    def test_types(self):
        assert isinstance(column(CashFlowItem, "kind").type, String)
        assert isinstance(column(CashFlowItem, "name").type, String)
        assert isinstance(column(CashFlowItem, "start_date").type, Date)
        assert isinstance(column(CashFlowItem, "end_date").type, Date)
        assert isinstance(column(CashFlowItem, "interval").type, Integer)
        assert isinstance(column(CashFlowItem, "unit").type, String)

    def test_amount_is_numeric_10_2(self):
        amount = column(CashFlowItem, "amount").type
        assert isinstance(amount, Numeric) and not amount.__class__.__name__ == "Float"
        assert (amount.precision, amount.scale) == (10, 2)

    def test_budget_id_references_budgets(self):
        assert fk_target(CashFlowItem, "budget_id") == "budgets.id"


class TestAssetColumns:
    def test_columns_match_the_diagram(self):
        assert set(Asset.__table__.columns.keys()) == {"id", "budget_id", "name", "balance"}

    def test_balance_is_numeric_10_2(self):
        balance = column(Asset, "balance").type
        assert isinstance(balance, Numeric) and not balance.__class__.__name__ == "Float"
        assert (balance.precision, balance.scale) == (10, 2)

    def test_budget_id_references_budgets(self):
        assert fk_target(Asset, "budget_id") == "budgets.id"


# --- Values survive a round trip through Postgres -------------------------


class TestRoundTrip:
    def test_money_comes_back_as_exact_decimal(self, session):
        budget = make_budget(session, make_user(session))
        item_id = make_item(session, budget).id
        asset_id = make_asset(session, budget).id
        session.expire_all()

        amount = session.get(CashFlowItem, item_id).amount
        balance = session.get(Asset, asset_id).balance
        assert isinstance(amount, Decimal) and amount == Decimal("1200.50")
        assert isinstance(balance, Decimal) and balance == Decimal("2500.00")

    def test_dates_come_back_as_dates(self, session):
        budget = make_budget(session, make_user(session))
        item_id = make_item(session, budget).id
        session.expire_all()

        item = session.get(CashFlowItem, item_id)
        assert item.start_date == date(2026, 10, 3)
        assert item.end_date == date(2027, 10, 3)
        assert session.get(Budget, budget.id).balance_as_of == date(2026, 10, 1)


# --- Password handling ----------------------------------------------------


class TestPassword:
    def test_password_is_not_readable(self, session):
        user = make_user(session)
        with pytest.raises(AttributeError):
            user.password

    def test_setter_stores_a_hash_not_the_password(self, session):
        user = make_user(session, password="password123")
        assert user._password_hash
        assert user._password_hash != "password123"
        assert "password123" not in user._password_hash

    def test_full_hash_is_saved_to_the_database(self, session):
        user_id = make_user(session, password="password123").id
        session.expire_all()
        assert session.get(User, user_id).authenticate("password123") is True

    def test_same_password_gets_a_different_hash_each_time(self, session):
        one = make_user(session, email="one@example.com", password="password123")
        two = make_user(session, email="two@example.com", password="password123")
        assert one._password_hash != two._password_hash

    def test_authenticate_correct_password(self, session):
        assert make_user(session, password="password123").authenticate("password123") is True

    def test_authenticate_wrong_password(self, session):
        user = make_user(session, password="password123")
        assert user.authenticate("password124") is False
        assert user.authenticate("") is False

    def test_changing_the_password_replaces_the_old_one(self, session):
        user = make_user(session, password="password123")
        user.password = "newpassword456"
        session.commit()
        assert user.authenticate("newpassword456") is True
        assert user.authenticate("password123") is False


# --- Relationships --------------------------------------------------------


class TestRelationships:
    def test_user_budgets_and_budget_user(self, session):
        user = make_user(session)
        budget = make_budget(session, user)
        assert budget.user is user
        assert user.budgets == [budget]

    def test_back_populates_without_a_commit(self, session):
        user = User(email="pat@example.com")
        budget = Budget(title="Current")
        user.budgets.append(budget)
        assert budget.user is user

        item = CashFlowItem(name="Rent")
        asset = Asset(name="Savings")
        budget.cash_flow_items.append(item)
        budget.assets.append(asset)
        assert item.budget is budget
        assert asset.budget is budget

    def test_foreign_keys_are_set_on_commit(self, session):
        user = make_user(session)
        budget = make_budget(session, user)
        item = make_item(session, budget)
        asset = make_asset(session, budget)
        assert budget.user_id == user.id
        assert item.budget_id == budget.id
        assert asset.budget_id == budget.id

    def test_budget_lists_its_items_and_assets(self, session):
        budget = make_budget(session, make_user(session))
        rent = make_item(session, budget, name="Rent")
        pay = make_item(session, budget, name="Paycheck")
        checking = make_asset(session, budget, name="Checking")
        assert set(budget.cash_flow_items) == {rent, pay}
        assert budget.assets == [checking]

    def test_one_users_budgets_do_not_show_up_for_another(self, session):
        pat = make_user(session, email="pat@example.com")
        sam = make_user(session, email="sam@example.com")
        make_budget(session, pat, title="Pat's")
        make_budget(session, sam, title="Sam's")
        assert [b.title for b in pat.budgets] == ["Pat's"]
        assert [b.title for b in sam.budgets] == ["Sam's"]


# --- Cascades -------------------------------------------------------------


def counts(session):
    return tuple(session.query(m).count() for m in (User, Budget, CashFlowItem, Asset))


class TestCascades:
    def test_deleting_a_user_deletes_everything_under_it(self, session):
        user = make_user(session)
        budget = make_budget(session, user)
        make_item(session, budget)
        make_asset(session, budget)
        assert counts(session) == (1, 1, 1, 1)

        session.delete(user)
        session.commit()
        assert counts(session) == (0, 0, 0, 0)

    def test_deleting_a_budget_deletes_its_items_and_assets_but_not_the_user(self, session):
        user = make_user(session)
        budget = make_budget(session, user)
        make_item(session, budget)
        make_asset(session, budget)

        session.delete(budget)
        session.commit()
        assert counts(session) == (1, 0, 0, 0)

    def test_deleting_one_budget_leaves_the_others_alone(self, session):
        user = make_user(session)
        keep = make_budget(session, user, title="Keep")
        make_item(session, keep)
        make_asset(session, keep)
        drop = make_budget(session, user, title="Drop")
        make_item(session, drop)

        session.delete(drop)
        session.commit()
        assert counts(session) == (1, 1, 1, 1)
        assert user.budgets == [keep]

    def test_removing_an_item_from_its_budget_deletes_it(self, session):
        budget = make_budget(session, make_user(session))
        item = make_item(session, budget)
        budget.cash_flow_items.remove(item)
        session.commit()
        assert session.query(CashFlowItem).count() == 0

    def test_removing_an_asset_from_its_budget_deletes_it(self, session):
        budget = make_budget(session, make_user(session))
        asset = make_asset(session, budget)
        budget.assets.remove(asset)
        session.commit()
        assert session.query(Asset).count() == 0

    def test_removing_a_budget_from_its_user_deletes_it(self, session):
        user = make_user(session)
        budget = make_budget(session, user)
        user.budgets.remove(budget)
        session.commit()
        assert session.query(Budget).count() == 0

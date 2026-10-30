"""Day 2 Block B: Asset validations and constraints."""

from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from helpers import column, make_budget, make_user, raw_insert
from models import Asset


@pytest.fixture
def budget(session):
    return make_budget(session, make_user(session))


def save(session, budget, name="Checking", balance=Decimal("2500.00")):
    asset = Asset(budget=budget, name=name, balance=balance)
    session.add(asset)
    session.commit()
    return asset


class TestName:
    def test_name_is_stripped(self, session, budget):
        assert save(session, budget, name="  Checking  ").name == "Checking"

    @pytest.mark.parametrize("blank", ["", "   ", None])
    def test_blank_name_raises(self, blank):
        with pytest.raises(ValueError):
            Asset(name=blank)

    def test_database_rejects_a_null_name(self, session, budget):
        with pytest.raises(IntegrityError):
            raw_insert(session, Asset, budget_id=budget.id, name=None, balance=Decimal("1.00"))
        session.rollback()


class TestBalance:
    @pytest.mark.parametrize("balance", [Decimal("-12000.00"), Decimal("0"), Decimal("8000.00")])
    def test_any_balance_is_allowed(self, session, budget, balance):
        assert save(session, budget, balance=balance).balance == balance

    def test_missing_balance_is_rejected(self, session, budget):
        with pytest.raises(IntegrityError):
            save(session, budget, balance=None)
        session.rollback()


class TestConstraints:
    @pytest.mark.parametrize("name", ["budget_id", "name", "balance"])
    def test_required_columns_are_not_nullable(self, name):
        assert column(Asset, name).nullable is False

    def test_an_asset_without_a_budget_is_rejected(self, session):
        session.add(Asset(name="Checking", balance=Decimal("1.00")))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

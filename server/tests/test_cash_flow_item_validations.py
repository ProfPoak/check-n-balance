"""Day 2 Block B: CashFlowItem validations and constraints."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from helpers import column, make_budget, make_user, raw_insert
from models import CashFlowItem

# Single-field rules: @validates raises ValueError on assignment, with a CHECK
# or nullable=False behind it. Cross-field rules (interval vs unit, end_date vs
# start_date) are CHECK constraints only, so they raise IntegrityError on commit.

VALID = dict(
    kind="expense",
    name="Rent",
    amount=Decimal("1450.00"),
    start_date=date(2026, 1, 1),
    end_date=None,
    interval=1,
    unit="month",
)


@pytest.fixture
def budget(session):
    return make_budget(session, make_user(session))


def save(session, budget, **overrides):
    item = CashFlowItem(budget=budget, **{**VALID, **overrides})
    session.add(item)
    session.commit()
    return item


def rejected_on_commit(session, budget, **overrides):
    with pytest.raises(IntegrityError):
        save(session, budget, **overrides)
    session.rollback()


def raw(session, budget, **overrides):
    raw_insert(session, CashFlowItem, budget_id=budget.id, **{**VALID, **overrides})


class TestName:
    def test_name_is_stripped(self, session, budget):
        assert save(session, budget, name="  Rent  ").name == "Rent"

    @pytest.mark.parametrize("blank", ["", "   ", None])
    def test_blank_name_raises(self, blank):
        with pytest.raises(ValueError):
            CashFlowItem(name=blank)


class TestKind:
    @pytest.mark.parametrize("kind", ["income", "expense"])
    def test_valid_kinds(self, session, budget, kind):
        assert save(session, budget, kind=kind).kind == kind

    @pytest.mark.parametrize("bad", ["gift", "Income", "", None])
    def test_other_kinds_raise(self, bad):
        with pytest.raises(ValueError):
            CashFlowItem(kind=bad)

    def test_database_rejects_a_bad_kind(self, session, budget):
        with pytest.raises(IntegrityError):
            raw(session, budget, kind="gift")
        session.rollback()


class TestAmount:
    def test_one_cent_is_allowed(self, session, budget):
        assert save(session, budget, amount=Decimal("0.01")).amount == Decimal("0.01")

    @pytest.mark.parametrize("bad", [Decimal("0"), Decimal("-5.00"), None])
    def test_zero_negative_or_missing_raises(self, bad):
        with pytest.raises(ValueError):
            CashFlowItem(amount=bad)

    def test_database_rejects_a_zero_amount(self, session, budget):
        with pytest.raises(IntegrityError):
            raw(session, budget, amount=Decimal("0"))
        session.rollback()


class TestUnit:
    @pytest.mark.parametrize("unit", ["day", "week", "month", "year"])
    def test_repeating_units(self, session, budget, unit):
        assert save(session, budget, unit=unit, interval=1).unit == unit

    def test_once(self, session, budget):
        assert save(session, budget, unit="once", interval=None).unit == "once"

    @pytest.mark.parametrize("bad", ["fortnight", "Month", "", None])
    def test_other_units_raise(self, bad):
        with pytest.raises(ValueError):
            CashFlowItem(unit=bad)

    def test_database_rejects_a_bad_unit(self, session, budget):
        with pytest.raises(IntegrityError):
            raw(session, budget, unit="fortnight")
        session.rollback()


class TestIntervalMatchesUnit:
    @pytest.mark.parametrize("interval", [1, 2, 10])
    def test_repeating_item_with_interval(self, session, budget, interval):
        assert save(session, budget, unit="week", interval=interval).interval == interval

    def test_repeating_item_without_interval_is_rejected(self, session, budget):
        rejected_on_commit(session, budget, unit="month", interval=None)

    @pytest.mark.parametrize("bad", [0, -1])
    def test_interval_below_one_is_rejected(self, session, budget, bad):
        rejected_on_commit(session, budget, unit="month", interval=bad)

    def test_once_with_an_interval_is_rejected(self, session, budget):
        rejected_on_commit(session, budget, unit="once", interval=1)


class TestEndDate:
    def test_end_date_is_optional(self, session, budget):
        assert save(session, budget, end_date=None).end_date is None

    def test_end_date_after_start(self, session, budget):
        assert save(session, budget, end_date=date(2026, 12, 1)).end_date == date(2026, 12, 1)

    def test_end_date_on_the_start_date(self, session, budget):
        assert save(session, budget, end_date=date(2026, 1, 1)).end_date == date(2026, 1, 1)

    def test_end_date_before_start_is_rejected(self, session, budget):
        rejected_on_commit(session, budget, end_date=date(2025, 12, 31))


class TestConstraints:
    @pytest.mark.parametrize("name", ["budget_id", "kind", "name", "amount", "start_date", "unit"])
    def test_required_columns_are_not_nullable(self, name):
        assert column(CashFlowItem, name).nullable is False

    @pytest.mark.parametrize("name", ["end_date", "interval"])
    def test_optional_columns_stay_nullable(self, name):
        assert column(CashFlowItem, name).nullable is True

    def test_check_constraints_are_named(self):
        # Block C's migration creates these by name
        names = {c.name for c in CashFlowItem.__table__.constraints}
        assert {
            "ck_cash_flow_items_kind_valid",
            "ck_cash_flow_items_amount_positive",
            "ck_cash_flow_items_unit_valid",
            "ck_cash_flow_items_interval_matches_unit",
            "ck_cash_flow_items_end_after_start",
        } <= names

    def test_an_item_without_a_budget_is_rejected(self, session):
        session.add(CashFlowItem(**VALID))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_an_item_without_a_start_date_is_rejected(self, session, budget):
        rejected_on_commit(session, budget, start_date=None)

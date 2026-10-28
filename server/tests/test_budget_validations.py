"""Day 2 Block A: Budget validations, defaults and constraints."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from helpers import column, make_budget, make_user, raw_insert
from models import Budget

# Two layers: @validates raises ValueError as soon as a bad value is assigned,
# and nullable=False / CHECK constraints make Postgres reject what slips past
# Python (IntegrityError on commit). raw_insert skips the validators on purpose,
# to prove the database backstop exists on its own.


class TestBudgetDefaults:
    def test_a_budget_needs_nothing_but_a_user(self, session):
        user = make_user(session)
        budget = Budget(user=user)
        session.add(budget)
        session.commit()
        assert budget.title == "Untitled budget"
        assert budget.balance_as_of == date.today()
        assert budget.description is None

    def test_given_values_win_over_the_defaults(self, session):
        budget = make_budget(session, make_user(session), title="Current")
        assert budget.title == "Current"
        assert budget.balance_as_of == date(2026, 10, 1)

    def test_balance_as_of_default_is_computed_per_insert(self):
        # default=date.today (the function), not date.today() (one date fixed at import)
        default = column(Budget, "balance_as_of").default
        assert default is not None and default.is_callable


class TestBudgetTitleValidation:
    def test_title_is_stripped(self, session):
        budget = make_budget(session, make_user(session), title="  Current  ")
        assert budget.title == "Current"

    @pytest.mark.parametrize("blank", ["", "   ", None])
    def test_blank_title_raises(self, blank):
        with pytest.raises(ValueError):
            Budget(title=blank)

    def test_reassigning_a_blank_title_raises(self, session):
        budget = make_budget(session, make_user(session), title="Current")
        with pytest.raises(ValueError):
            budget.title = "   "
        assert budget.title == "Current"

    def test_50_characters_is_allowed(self, session):
        budget = make_budget(session, make_user(session), title="a" * 50)
        assert budget.title == "a" * 50

    def test_51_characters_raises(self):
        with pytest.raises(ValueError):
            Budget(title="a" * 51)

    def test_length_is_checked_after_stripping(self, session):
        budget = make_budget(session, make_user(session), title="  " + "a" * 50 + "  ")
        assert budget.title == "a" * 50

    def test_title_column_is_string_50(self):
        assert column(Budget, "title").type.length == 50


class TestBudgetConstraints:
    @pytest.mark.parametrize("name", ["user_id", "title", "balance_as_of"])
    def test_required_columns_are_not_nullable(self, name):
        assert column(Budget, name).nullable is False

    def test_description_stays_optional(self):
        assert column(Budget, "description").nullable is True

    def test_a_budget_without_a_user_is_rejected(self, session):
        session.add(Budget(title="Orphan"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_database_rejects_a_null_title(self, session):
        user_id = make_user(session).id
        with pytest.raises(IntegrityError):
            raw_insert(session, Budget, user_id=user_id, title=None, balance_as_of=date(2026, 10, 1))
        session.rollback()

    def test_database_rejects_a_null_balance_as_of(self, session):
        user_id = make_user(session).id
        with pytest.raises(IntegrityError):
            raw_insert(session, Budget, user_id=user_id, title="Current", balance_as_of=None)
        session.rollback()

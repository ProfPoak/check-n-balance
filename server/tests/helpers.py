"""Shared builders and lookups for the model tests."""

from datetime import date
from decimal import Decimal

from models import Asset, Budget, CashFlowItem, User


def make_user(session, email="pat@example.com", password="password123"):
    user = User(email=email)
    user.password = password
    session.add(user)
    session.commit()
    return user


def make_budget(session, user, title="Current"):
    budget = Budget(title=title, description="Real numbers", balance_as_of=date(2026, 10, 1), user=user)
    session.add(budget)
    session.commit()
    return budget


def make_item(session, budget, name="Paycheck"):
    item = CashFlowItem(
        budget=budget,
        kind="income",
        name=name,
        amount=Decimal("1200.50"),
        start_date=date(2026, 10, 3),
        end_date=date(2027, 10, 3),
        interval=2,
        unit="week",
    )
    session.add(item)
    session.commit()
    return item


def make_asset(session, budget, name="Checking"):
    asset = Asset(budget=budget, name=name, balance=Decimal("2500.00"))
    session.add(asset)
    session.commit()
    return asset


def column(model, name):
    return model.__table__.columns[name]


def fk_target(model, name):
    fks = list(column(model, name).foreign_keys)
    assert len(fks) == 1, f"{model.__name__}.{name} should have exactly one foreign key"
    return fks[0].target_fullname


def raw_insert(session, model, **values):
    session.execute(model.__table__.insert().values(**values))
    session.commit()

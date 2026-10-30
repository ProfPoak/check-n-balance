from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta

from config import app, db
from models import Asset, Budget, CashFlowItem, User


# Five items every budget starts with; a fresh copy for each budget
def base_items(next_month):
    return [
        CashFlowItem(kind='income', name='Paycheck', amount=Decimal('2100.00'),
                     start_date=date(2026, 1, 2), interval=2, unit='week'),
        CashFlowItem(kind='expense', name='Rent', amount=Decimal('1450.00'),
                     start_date=date(2026, 1, 1), interval=1, unit='month'),
        CashFlowItem(kind='expense', name='Car payment', amount=Decimal('320.00'),
                     start_date=date(2025, 6, 15), end_date=date(2029, 5, 15), interval=1, unit='month'),
        CashFlowItem(kind='expense', name='Car insurance', amount=Decimal('960.00'),
                     start_date=date(2026, 3, 1), interval=1, unit='year'),
        # Pegged to next month so it always lands inside the 6-month window
        CashFlowItem(kind='expense', name='Vet visit', amount=Decimal('400.00'),
                     start_date=next_month.replace(day=10), interval=None, unit='once'),
    ]


def base_assets():
    return [
        Asset(name='Checking', balance=Decimal('2500.00')),
        Asset(name='Savings', balance=Decimal('8000.00')),
    ]


def seed():
    print('Seeding...')

    # Children first: query.delete() is a bulk delete and skips the ORM cascades
    for model in (Asset, CashFlowItem, Budget, User):
        model.query.delete()

    today = date.today()
    next_month = today.replace(day=1) + relativedelta(months=1)

    demo = User(email='demo@example.com')
    demo.password = 'password123'

    current = Budget(title='Current', description='Real numbers',
                     balance_as_of=today, user=demo)
    current.cash_flow_items = base_items(next_month)
    current.assets = base_assets()

    what_if = Budget(title='New car what-if', description='Current, plus a bigger car payment',
                     balance_as_of=today, user=demo)
    what_if.cash_flow_items = base_items(next_month) + [
        # 60 payments: the first on next_month, the last 59 months later
        CashFlowItem(kind='expense', name='New car payment', amount=Decimal('540.00'),
                     start_date=next_month, end_date=next_month + relativedelta(months=59),
                     interval=1, unit='month'),
    ]
    what_if.assets = base_assets()

    db.session.add(demo)
    db.session.commit()

    print('Seeded:', ', '.join(
        f'{model.__tablename__} {model.query.count()}'
        for model in (User, Budget, CashFlowItem, Asset)
    ))


if __name__ == '__main__':
    with app.app_context():
        try:
            seed()
        except Exception as e:
            db.session.rollback()
            print(f'Seed failed: {e}')
            raise

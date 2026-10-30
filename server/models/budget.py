from datetime import date

from config import db
from sqlalchemy.orm import validates


class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(50), nullable=False, default='Untitled budget')
    description = db.Column(db.Text)
    balance_as_of = db.Column(db.Date, nullable=False, default=date.today)

    # user relationship
    user = db.relationship('User', back_populates='budgets')

    # cash_flow_items relationship
    cash_flow_items = db.relationship('CashFlowItem', back_populates='budget', cascade='all, delete-orphan')

    # assets relationship
    assets = db.relationship('Asset', back_populates='budget', cascade='all, delete-orphan')

    @validates('title')
    def validate_title(self, key, value):
        value = (value or '').strip()
        if not 1 <= len(value) <= 50:
            raise ValueError('Title must be 1 to 50 characters')
        return value

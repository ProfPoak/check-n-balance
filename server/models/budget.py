from config import db


class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    title = db.Column(db.String)
    description = db.Column(db.Text)
    balance_as_of = db.Column(db.Date)

    # user relationship
    user = db.relationship('User', back_populates='budgets')

    # cash_flow_items relationship
    cash_flow_items = db.relationship('CashFlowItem', back_populates='budget', cascade='all, delete-orphan')

    # assets relationship
    assets = db.relationship('Asset', back_populates='budget', cascade='all, delete-orphan')
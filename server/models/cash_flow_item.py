from config import db


class CashFlowItem(db.Model):
    __tablename__ = "cash_flow_items"

    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'))
    kind = db.Column(db.String)
    name = db.Column(db.String)
    amount = db.Column(db.Numeric(10,2))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    interval = db.Column(db.Integer)
    unit = db.Column(db.String)

    # budget relationship
    budget = db.relationship('Budget', back_populates='cash_flow_items')

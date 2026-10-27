from config import db


class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, foreign_key=True)
    title = db.Column(db.String)
    description = db.Column(db.Text)
    balance_as_of = db.Column(db.Date)

    # user relationship
    # cash_flow_items relationship
    # assets relationship

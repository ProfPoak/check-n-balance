from config import db


class CashFlowItem(db.Model):
    __tablename__ = "cash_flow_items"

    id = db.Column(db.Integer, primary_key=True)
    # budget_id
    # kind
    # name
    # amount
    # start_date
    # end_date
    # interval
    # unit

    # budget relationship

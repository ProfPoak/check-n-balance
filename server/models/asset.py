from config import db


class Asset(db.Model):
    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'))
    name = db.Column(db.String)
    balance = db.Column(db.Numeric(10,2))

    # budget relationship
    budget = db.relationship('Budget', back_populates='assets')

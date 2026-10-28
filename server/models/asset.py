from config import db
from sqlalchemy.orm import validates


class Asset(db.Model):
    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'), nullable=False)
    name = db.Column(db.String, nullable=False)
    # may be negative (e.g. a loan)
    balance = db.Column(db.Numeric(10,2), nullable=False)

    # budget relationship
    budget = db.relationship('Budget', back_populates='assets')

    # name: stripped, required
    @validates('name')
    def validate_name(self, key, value):
        value = (value or '').strip()
        if not value:
            raise ValueError('Name is required')
        return value

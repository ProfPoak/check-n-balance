from config import db


class Asset(db.Model):
    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    # budget_id
    # name
    # balance

    # budget relationship

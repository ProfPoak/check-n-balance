from config import db
from sqlalchemy.orm import validates

KINDS = ('income', 'expense')
UNITS = ('once', 'day', 'week', 'month', 'year')


class CashFlowItem(db.Model):
    __tablename__ = "cash_flow_items"
    # Database backstops; the naming convention prefixes each name with ck_cash_flow_items_
    # Cross-field rules (interval vs unit, end_date vs start_date) are enforced here only
    __table_args__ = (
        db.CheckConstraint("kind IN ('income', 'expense')", name='kind_valid'),
        db.CheckConstraint("amount > 0", name='amount_positive'),
        db.CheckConstraint("unit IN ('once', 'day', 'week', 'month', 'year')", name='unit_valid'),
        # IS NOT NULL is required: FALSE OR NULL is NULL, and a CHECK only fails on FALSE
        db.CheckConstraint(
            "(unit = 'once' AND interval IS NULL) "
            "OR (unit <> 'once' AND interval IS NOT NULL AND interval >= 1)",
            name='interval_matches_unit',
        ),
        db.CheckConstraint("end_date IS NULL OR end_date >= start_date", name='end_after_start'),
    )

    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'), nullable=False)
    kind = db.Column(db.String, nullable=False)
    name = db.Column(db.String, nullable=False)
    amount = db.Column(db.Numeric(10,2), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)
    interval = db.Column(db.Integer)
    unit = db.Column(db.String, nullable=False)

    # budget relationship
    budget = db.relationship('Budget', back_populates='cash_flow_items')

    @validates('name')
    def validate_name(self, key, value):
        value = (value or '').strip()
        if not value:
            raise ValueError('Name is required')
        return value

    @validates('kind')
    def validate_kind(self, key, value):
        if value not in KINDS:
            raise ValueError('Kind must be income or expense')
        return value

    @validates('amount')
    def validate_amount(self, key, value):
        if value is None or value <= 0:
            raise ValueError('Amount must be greater than 0')
        return value

    @validates('unit')
    def validate_unit(self, key, value):
        if value not in UNITS:
            raise ValueError('Unit must be once, day, week, month or year')
        return value

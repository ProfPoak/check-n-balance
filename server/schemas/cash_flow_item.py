from decimal import Decimal

from marshmallow import EXCLUDE, Schema, ValidationError, fields, validate, validates_schema

from models.cash_flow_item import KINDS, UNITS


class CashFlowItemSchema(Schema):
    """Shape, allowed values and money range per field; interval/unit and end/start rules in @validates_schema."""
    pass

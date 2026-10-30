from marshmallow import EXCLUDE, Schema, fields

from .asset import AssetSchema
from .cash_flow_item import CashFlowItemSchema


class BudgetSchema(Schema):
    """Every field optional (load({}) == {}); dumps nested cash_flow_items and assets."""
    pass

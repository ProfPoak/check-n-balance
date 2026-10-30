from marshmallow import EXCLUDE, Schema, fields

from .asset import AssetSchema
from .cash_flow_item import CashFlowItemSchema


class BudgetSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Integer(dump_only=True)
    title = fields.String()
    description = fields.String(allow_none=True)
    balance_as_of = fields.Date()
    cash_flow_items = fields.Nested(CashFlowItemSchema, many=True, dump_only=True)
    assets = fields.Nested(AssetSchema, many=True, dump_only=True)

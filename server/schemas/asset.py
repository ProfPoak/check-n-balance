from decimal import Decimal

from marshmallow import EXCLUDE, Schema, fields, validate

CAP = Decimal("100000000")

class AssetSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Integer(dump_only=True)
    name = fields.String(required=True)
    balance = fields.Decimal(places=2, as_string=True, required=True, 
                             validate=validate.Range(min=-CAP, max=CAP, min_inclusive=False, max_inclusive=False))

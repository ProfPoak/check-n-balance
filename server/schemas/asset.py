from decimal import Decimal

from marshmallow import EXCLUDE, Schema, fields, validate


class AssetSchema(Schema):
    """name and balance required; balance strictly between -10^8 and 10^8."""
    pass

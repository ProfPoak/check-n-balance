from decimal import Decimal

from marshmallow import EXCLUDE, Schema, ValidationError, fields, validate, validates_schema

from models.cash_flow_item import KINDS, UNITS


class CashFlowItemSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Integer(dump_only=True)
    kind = fields.String(required=True, validate=validate.OneOf(KINDS))
    name = fields.String(required=True)
    amount = fields.Decimal(places=2, as_string=True, required=True,
                            validate=validate.Range(min=0, max=Decimal("100000000"), min_inclusive=False, max_inclusive=False))
    start_date = fields.Date(required=True)
    end_date= fields.Date(allow_none=True)
    interval = fields.Integer(allow_none=True, validate=validate.Range(min=1))
    unit = fields.String(required=True, validate=validate.OneOf(UNITS))

    @validates_schema
    def check_cross_fields(self, data, **kwargs):
        if "unit" in data:
            if data["unit"] == "once" and data.get("interval") is not None:
                raise ValidationError("Single entry items cannot have an interval", "interval")
            if data["unit"] != "once" and data.get("interval") is None:
                raise ValidationError("Interval is required for reoccuring entries", "interval")
        if data.get("start_date") and data.get("end_date") and data["end_date"] < data["start_date"]:
            raise ValidationError("End date cannot be before start date", "end_date")

from marshmallow import Schema, fields


class TimelineEntrySchema(Schema):
    item_id = fields.Int()
    name = fields.String()
    kind = fields.String()
    amount = fields.Decimal(places=2, as_string=True)
    date = fields.Date()

class MonthlyRowSchema(Schema):
    month = fields.String()
    income = fields.Decimal(places=2, as_string=True)
    expenses = fields.Decimal(places=2, as_string=True)
    net = fields.Decimal(places=2, as_string=True)


class ProjectionSchema(Schema):
    as_of = fields.Date()
    to = fields.Date()
    starting_balance = fields.Decimal(places=2, as_string=True)
    income = fields.Decimal(places=2, as_string=True)
    expenses = fields.Decimal(places=2, as_string=True)
    net = fields.Decimal(places=2, as_string=True)
    projected_balance = fields.Decimal(places=2, as_string=True)

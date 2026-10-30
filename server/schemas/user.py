from marshmallow import EXCLUDE, Schema, fields


class UserSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Integer(dump_only=True)
    email = fields.String(required=True)
    password = fields.String(required=True, load_only=True)

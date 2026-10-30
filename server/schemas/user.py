from marshmallow import EXCLUDE, Schema, fields


class UserSchema(Schema):
    """Dumps {id, email}; loads email and password (password is load_only)."""
    pass

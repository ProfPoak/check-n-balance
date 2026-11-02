from flask import session, request
from marshmallow import ValidationError

from config import db
from models import Budget, User


def current_user():
    user_id = session.get("user_id")
    if user_id is None:
        return None
    return db.session.get(User, user_id)

def require_login():
    if current_user() is None:
        return {"error": "Not logged in"}, 401
    return

def get_owned(model, id):
    obj = model.query.filter_by(id=id).first()
    if obj is None:
        return None, ({"error": f"{model.__name__} not found"}, 404)
    owner_id = obj.user_id if isinstance(obj, Budget) else obj.budget.user_id
    if owner_id != current_user().id:
        return None, ({"error": "Forbidden"}, 403)
    return obj, None

def apply_fields(obj, body, schema):
    try:
        data = schema.load(body)
    except ValidationError as e:
        return {"errors": e.messages}, 422
    errors = {}
    for key, value in data.items():
        try:
            setattr(obj, key, value)
        except ValueError as e:
            errors[key] = [str(e)]
    if errors:
        db.session.rollback()
        return {"errors": errors}, 422
    return None

def merged_body(obj, schema):
    body = request.get_json()
    if isinstance(body, dict):
        return {**schema.dump(obj), **body}
    return body

def save_error(name):
    return {"errors": {name: ["Could not save this {name}"]}}, 422
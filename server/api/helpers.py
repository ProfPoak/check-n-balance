from flask import session

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

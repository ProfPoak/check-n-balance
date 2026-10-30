from flask import Blueprint, request, session
from flask_restful import Api, Resource
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from config import db
from models import User
from schemas import UserSchema
from .helpers import current_user

auth_bp = Blueprint("auth", __name__)
api = Api(auth_bp)


class Signup(Resource):
    def post(self):
        try:
            data = UserSchema().load(request.get_json())
        except ValidationError as e:
            return {"errors": e.messages}, 422

        user = User()
        errors = {}
        for field in ("email", "password"):
            try:
                setattr(user, field, data[field])
            except ValueError as e:
                errors[field] = [str(e)]
        if errors:
            return {"errors": errors}, 422

        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return {"errors": {"email": ["An account is already associated with this email address. Please log in or use a different email."]}}, 422

        session["user_id"] = user.id
        return UserSchema().dump(user), 201

class Login(Resource):
    def post(self):
        data = request.get_json()
        email, password = data.get("email"), data.get("password")
        if not email or not password:
            return {"error": "Invalid email or password"}, 401

        user = User.query.filter_by(email=email.strip().lower()).first()
        if not user or not user.authenticate(password):
            return {"error": "Invalid email or password"}, 401

        session["user_id"] = user.id
        return UserSchema().dump(user), 200


class CheckSession(Resource):
    def get(self):
        """200 + user, or 401 {"error": ...}."""
        pass


class Logout(Resource):
    def delete(self):
        """204, session cleared (even when nobody is logged in)."""
        pass


api.add_resource(Signup, "/signup")
api.add_resource(Login, "/login")
api.add_resource(CheckSession, "/check_session")
api.add_resource(Logout, "/logout")

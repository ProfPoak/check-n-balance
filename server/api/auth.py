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
        """201 + user and log in; 422 {"errors": {field: [...]}} for bad input or a duplicate email."""
        pass


class Login(Resource):
    def post(self):
        """200 + user and log in; 401 {"error": "Invalid email or password"} otherwise."""
        pass


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

from flask import Blueprint, request
from flask_restful import Api, Resource
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from config import db
from models import Budget
from schemas import BudgetSchema
from .helpers import current_user, get_owned, require_login

budgets_bp = Blueprint("budgets", __name__)
budgets_bp.before_request(require_login)
api = Api(budgets_bp)


class Budgets(Resource):
    def get(self):
        pass

    def post(self):
        pass


class BudgetById(Resource):
    def get(self, id):
        pass

    def patch(self, id):
        pass

    def delete(self, id):
        pass


api.add_resource(Budgets, "/budgets")
api.add_resource(BudgetById, "/budgets/<int:id>")

from flask import Blueprint, request
from flask_restful import Api, Resource
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from config import db
from models import Budget, CashFlowItem
from schemas import CashFlowItemSchema
from .helpers import get_owned, require_login

items_bp = Blueprint("cash_flow_items", __name__)
items_bp.before_request(require_login)
api = Api(items_bp)


class BudgetCashFlowItems(Resource):
    def post(self, id):
        pass


class CashFlowItemById(Resource):
    def patch(self, id):
        pass

    def delete(self, id):
        pass


api.add_resource(BudgetCashFlowItems, "/budgets/<int:id>/cash_flow_items")
api.add_resource(CashFlowItemById, "/cash_flow_items/<int:id>")

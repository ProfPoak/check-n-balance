from flask import Blueprint, request
from flask_restful import Api, Resource
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from config import db
from models import Budget, CashFlowItem
from schemas import CashFlowItemSchema
from .helpers import apply_fields, get_owned, require_login, merged_body, save_error

items_bp = Blueprint("cash_flow_items", __name__)
items_bp.before_request(require_login)
api = Api(items_bp)


class BudgetCashFlowItems(Resource):
    def post(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err
        
        item = CashFlowItem()
        schema = CashFlowItemSchema()
        err = apply_fields(item, request.get_json(), schema)
        if err:
            return err

        item.budget_id = budget.id
        db.session.add(item)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("cash flow item")

        return schema.dump(item), 201


class CashFlowItemById(Resource):
    def patch(self, id):
        item, err = get_owned(CashFlowItem, id)
        if err:
            return err

        schema = CashFlowItemSchema()
        err = apply_fields(item, merged_body(item, schema), schema)
        if err:
            return err

        db.session.add(item)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("cash flow item")

        return schema.dump(item), 200

    def delete(self, id):
        item, err = get_owned(CashFlowItem, id)
        if err:
            return err

        db.session.delete(item)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("cash flow item")

        return {}, 204

api.add_resource(BudgetCashFlowItems, "/budgets/<int:id>/cash_flow_items")
api.add_resource(CashFlowItemById, "/cash_flow_items/<int:id>")

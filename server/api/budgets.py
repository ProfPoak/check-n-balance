from flask import Blueprint, request
from flask_restful import Api, Resource
from sqlalchemy.exc import IntegrityError

from config import db
from models import Budget
from schemas import BudgetSchema
from .helpers import apply_fields, current_user, get_owned, require_login, merged_body, save_error

budgets_bp = Blueprint("budgets", __name__)
budgets_bp.before_request(require_login)
api = Api(budgets_bp)


class Budgets(Resource):
    def get(self):
        budgets = Budget.query.filter_by(user_id=current_user().id).order_by(Budget.id).all()
        return BudgetSchema(many=True, exclude=("cash_flow_items", "assets")).dump(budgets), 200

    def post(self):
        budget = Budget()
        err = apply_fields(budget, request.get_json(), BudgetSchema())
        if err:
            return err

        budget.user = current_user()
        db.session.add(budget)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("budget")
        return BudgetSchema().dump(budget), 201


class BudgetById(Resource):
    def get(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err
        return BudgetSchema().dump(budget), 200

    def patch(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err

        schema = BudgetSchema()
        err = apply_fields(budget, merged_body(budget, schema), schema)
        if err:
            return err

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("budget")
        return schema.dump(budget), 200

    def delete(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err
        db.session.delete(budget)
        db.session.commit()
        return {}, 204


api.add_resource(Budgets, "/budgets")
api.add_resource(BudgetById, "/budgets/<int:id>")

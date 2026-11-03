from dateutil.relativedelta import relativedelta
from flask import Blueprint
from flask_restful import Api, Resource
from marshmallow import ValidationError

from models import Budget
from schemas import MonthlyRowSchema, ProjectionSchema, TimelineEntrySchema
from timeline import build_timeline, monthly_totals
from .helpers import get_owned, require_login
from .projection_helpers import date_param, default_window, month_param, months_param

projections_bp = Blueprint("projections", __name__)
projections_bp.before_request(require_login)
api = Api(projections_bp)


class Timeline(Resource):
    def get(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err

        first, last = default_window()
        try:
            start = date_param("start", first)
            end = date_param("end", last)
        except ValidationError as e:
            return {"errors": e.messages}, 422

        if end < start:
            return {"errors": {"end": ["end must be on or after start"]}}, 422

        entries = build_timeline(budget.cash_flow_items, start, end)
        return TimelineEntrySchema(many=True).dump(entries), 200


class Monthly(Resource):
    def get(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err

        first, _ = default_window()
        try:
            start = month_param("start", first)
            months = months_param("months", 6)
        except ValidationError as e:
            return {"errors": e.messages}, 422

        end = start + relativedelta(months=months, days=-1)
        entries = build_timeline(budget.cash_flow_items, start, end)
        rows = monthly_totals(entries, start, months)
        return MonthlyRowSchema(many=True).dump(rows), 200


class Projection(Resource):
    def get(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err

        try:
            to = date_param("to", None)
        except ValidationError as e:
            return {"errors": e.messages}, 422

        if to is None:
            return {"errors": {"to": ["to is required"]}}, 422

        as_of = budget.balance_as_of
        if to < as_of:
            return {"errors": {"to": ["Projection date must be on or after the assets balance date"]}}, 422

        entries = build_timeline(budget.cash_flow_items, as_of + relativedelta(days=1), to)

        income = sum(e["amount"] for e in entries if e["kind"] == "income")
        expenses = sum(e["amount"] for e in entries if e["kind"] == "expense")
        starting = sum(a.balance for a in budget.assets)
        net = income - expenses

        return ProjectionSchema().dump(
            {
                "as_of": as_of,
                "to": to,
                "starting_balance": starting,
                "income": income,
                "expenses": expenses,
                "net": net,
                "projected_balance": starting + net,
            }
        ), 200


api.add_resource(Timeline, "/budgets/<int:id>/timeline")
api.add_resource(Monthly, "/budgets/<int:id>/monthly")
api.add_resource(Projection, "/budgets/<int:id>/projection")

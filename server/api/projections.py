from datetime import date, datetime

from dateutil.relativedelta import relativedelta
from flask import Blueprint, request
from flask_restful import Api, Resource
from marshmallow import ValidationError

from models import Budget
from schemas import MonthlyRowSchema, TimelineEntrySchema
from timeline import build_timeline, monthly_totals
from .helpers import get_owned, require_login

projections_bp = Blueprint("projections", __name__)
projections_bp.before_request(require_login)
api = Api(projections_bp)


def default_window():
    pass


def check_year(name, value):
    pass


def date_param(name, default):
    pass


def month_param(name, default):
    pass


def months_param(name, default):
    pass


class Timeline(Resource):
    def get(self, id):
        pass


class Monthly(Resource):
    def get(self, id):
        pass


api.add_resource(Timeline, "/budgets/<int:id>/timeline")
api.add_resource(Monthly, "/budgets/<int:id>/monthly")

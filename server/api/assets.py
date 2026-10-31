from flask import Blueprint, request
from flask_restful import Api, Resource
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from config import db
from models import Asset, Budget
from schemas import AssetSchema
from .helpers import get_owned, require_login

assets_bp = Blueprint("assets", __name__)
assets_bp.before_request(require_login)
api = Api(assets_bp)


class BudgetAssets(Resource):
    def post(self, id):
        pass


class AssetById(Resource):
    def patch(self, id):
        pass

    def delete(self, id):
        pass


api.add_resource(BudgetAssets, "/budgets/<int:id>/assets")
api.add_resource(AssetById, "/assets/<int:id>")

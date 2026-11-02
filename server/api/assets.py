from flask import Blueprint, request
from flask_restful import Api, Resource
from sqlalchemy.exc import IntegrityError

from config import db
from models import Asset, Budget
from schemas import AssetSchema
from .helpers import get_owned, require_login, apply_fields, merged_body, save_error

assets_bp = Blueprint("assets", __name__)
assets_bp.before_request(require_login)
api = Api(assets_bp)


class BudgetAssets(Resource):
    def post(self, id):
        budget, err = get_owned(Budget, id)
        if err:
            return err

        asset = Asset()
        schema = AssetSchema()
        err = apply_fields(asset, request.get_json(), schema)
        if err:
            return err

        asset.budget_id = budget.id

        db.session.add(asset)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("asset")

        return schema.dump(asset), 201


class AssetById(Resource):
    def patch(self, id):
        asset, err = get_owned(Asset, id)
        if err:
            return err

        schema = AssetSchema()
        err = apply_fields(asset, merged_body(asset, schema), schema)
        if err:
            return err

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("asset")

        return schema.dump(asset), 200

    def delete(self, id):
        asset, err = get_owned(Asset, id)
        if err:
            return err

        db.session.delete(asset)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return save_error("asset")

        return {}, 204


api.add_resource(BudgetAssets, "/budgets/<int:id>/assets")
api.add_resource(AssetById, "/assets/<int:id>")

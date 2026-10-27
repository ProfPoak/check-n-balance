from flask import Blueprint

home_bp = Blueprint("home", __name__)

@home_bp.get("/")
def index():
    return {"message": "Check'N Balance API"}
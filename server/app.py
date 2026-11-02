from config import app
from api.home import home_bp
from api.auth import auth_bp
from api.budgets import budgets_bp
from api.cash_flow_items import items_bp
from api.assets import assets_bp
from api.projections import projections_bp
import models

app.register_blueprint(home_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(budgets_bp)
app.register_blueprint(items_bp)
app.register_blueprint(assets_bp)
app.register_blueprint(projections_bp)

if __name__ == "__main__":
    app.run(port=5555, debug=True)

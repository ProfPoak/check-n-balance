from config import app
from api.home import home_bp
from api.auth import auth_bp
import models

app.register_blueprint(home_bp)
app.register_blueprint(auth_bp)

if __name__ == "__main__":
    app.run(port=5555, debug=True)

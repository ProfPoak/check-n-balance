import os

from dotenv import load_dotenv
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

# Explicit path so it loads from any working directory
# No override=True: tests set DATABASE_URL before importing this, and it must win over .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


def database_url(url):
    """Render (and Heroku) hand out postgres:// or postgresql:// URLs. SQLAlchemy 2.1 reads
    a bare postgresql:// as psycopg v3, which isn't installed, so pin the psycopg2 driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg2://" + url[len(prefix):]
    return url


app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]
app.config["SQLALCHEMY_DATABASE_URI"] = database_url(os.environ["DATABASE_URL"])
# Set SESSION_COOKIE_SECURE=1 in production (HTTPS only); local dev runs on plain http
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE") == "1"
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.json.compact = False

# Named constraints so later migrations can alter or drop them
metadata = MetaData(naming_convention={
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
})
db = SQLAlchemy(metadata=metadata)
db.init_app(app)

migrate = Migrate(app, db)

bcrypt = Bcrypt(app)

import os

from dotenv import dotenv_values

# Must run before config is imported: point the app at the test database.
# load_dotenv in config won't override this, so the dev database is never touched.
_env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
_test_url = os.environ.get("TEST_DATABASE_URL") or _env.get("TEST_DATABASE_URL")
assert _test_url and _test_url.endswith("_test"), (
    "TEST_DATABASE_URL must be set and end in _test; refusing to run against another database"
)
os.environ["DATABASE_URL"] = _test_url

import pytest

from config import app, bcrypt, db
import models  # noqa: F401  (registers every table before create_all)
import app as app_module  # noqa: F401  (registers every blueprint)
from helpers import make_user

# Minimum bcrypt cost, for tests only: hashing at the app's 12 rounds dominates the suite's run time
bcrypt._log_rounds = 4


@pytest.fixture(autouse=True)
def session():
    """Every test gets fresh tables in the test database, dropped afterwards."""
    with app.app_context():
        db.create_all()
        yield db.session
        db.session.rollback()
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client():
    """Flask test client; keeps the session cookie between requests."""
    return app.test_client()


def logged_in_client(user):
    """A test client whose session already holds this user's id (skips the login route)."""
    c = app.test_client()
    with c.session_transaction() as s:
        s["user_id"] = user.id
    return c


@pytest.fixture
def user_a(session):
    return make_user(session, email="a@example.com")


@pytest.fixture
def user_b(session):
    return make_user(session, email="b@example.com")


@pytest.fixture
def client_a(user_a):
    return logged_in_client(user_a)


@pytest.fixture
def client_b(user_b):
    return logged_in_client(user_b)

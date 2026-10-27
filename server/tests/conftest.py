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

from config import app, db
import models  # noqa: F401  (registers every table before create_all)


@pytest.fixture(autouse=True)
def session():
    """Every test gets fresh tables in the test database, dropped afterwards."""
    with app.app_context():
        db.create_all()
        yield db.session
        db.session.rollback()
        db.session.remove()
        db.drop_all()

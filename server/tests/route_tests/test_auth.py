"""Auth routes (signup, login, check_session, logout) and the current_user() helper."""

import pytest
from flask import session as flask_session

from api.helpers import current_user
from config import app
from helpers import make_user
from models import User

PASSWORD = "password123"
INVALID = {"error": "Invalid email or password"}


def signup(client, email="pat@example.com", password=PASSWORD):
    return client.post("/signup", json={"email": email, "password": password})


def login(client, email="pat@example.com", password=PASSWORD):
    return client.post("/login", json={"email": email, "password": password})


def session_user_id(client):
    with client.session_transaction() as s:
        return s.get("user_id")


def assert_no_secrets(resp):
    text = resp.get_data(as_text=True)
    assert "password" not in text
    assert "$2b$" not in text  # bcrypt hash prefix


# ---------- POST /signup ----------

class TestSignup:
    def test_creates_user_returns_201_and_logs_in(self, client):
        resp = signup(client)
        assert resp.status_code == 201
        user = User.query.one()
        assert resp.get_json() == {"id": user.id, "email": "pat@example.com"}
        assert session_user_id(client) == user.id
        assert_no_secrets(resp)

    def test_email_is_stored_normalized(self, client):
        resp = signup(client, email="  Pat@Example.COM ")
        assert resp.status_code == 201
        assert resp.get_json()["email"] == "pat@example.com"

    @pytest.mark.parametrize("missing", ["email", "password"])
    def test_missing_field_is_422(self, client, missing):
        body = {"email": "pat@example.com", "password": PASSWORD}
        del body[missing]
        resp = client.post("/signup", json=body)
        assert resp.status_code == 422
        assert missing in resp.get_json()["errors"]

    @pytest.mark.parametrize("field, email, password", [
        ("email", "not-an-email", PASSWORD),
        ("password", "pat@example.com", "short"),
    ])
    def test_invalid_value_is_422_and_creates_nothing(self, client, field, email, password):
        resp = signup(client, email=email, password=password)
        assert resp.status_code == 422
        assert field in resp.get_json()["errors"]
        assert User.query.count() == 0
        assert session_user_id(client) is None

    def test_duplicate_email_in_any_case_is_422(self, client):
        signup(client)
        other = client.application.test_client()
        resp = signup(other, email="PAT@example.com")
        assert resp.status_code == 422
        assert "email" in resp.get_json()["errors"]
        assert User.query.count() == 1
        assert session_user_id(other) is None

    def test_signup_still_works_after_a_duplicate(self, client):
        # A caught IntegrityError must be rolled back, or the next commit fails
        signup(client)
        signup(client)
        resp = signup(client, email="sam@example.com")
        assert resp.status_code == 201
        assert User.query.count() == 2


# ---------- POST /login ----------

class TestLogin:
    def test_returns_200_and_the_user_and_logs_in(self, client, session):
        user = make_user(session)
        resp = login(client)
        assert resp.status_code == 200
        assert resp.get_json() == {"id": user.id, "email": "pat@example.com"}
        assert session_user_id(client) == user.id
        assert_no_secrets(resp)

    def test_email_is_matched_stripped_and_lowercased(self, client, session):
        make_user(session)
        assert login(client, email="  PAT@Example.com ").status_code == 200

    def test_wrong_password_is_401(self, client, session):
        make_user(session)
        resp = login(client, password="wrong-password")
        assert resp.status_code == 401
        assert resp.get_json() == INVALID
        assert session_user_id(client) is None

    def test_unknown_email_is_401(self, client, session):
        make_user(session)
        resp = login(client, email="nobody@example.com")
        assert resp.status_code == 401
        assert resp.get_json() == INVALID

    @pytest.mark.parametrize("body", [{}, {"email": "pat@example.com"}, {"password": PASSWORD}])
    def test_missing_fields_are_401(self, client, session, body):
        make_user(session)
        resp = client.post("/login", json=body)
        assert resp.status_code == 401
        assert resp.get_json() == INVALID


# ---------- GET /check_session ----------

class TestCheckSession:
    def test_logged_in_returns_200_and_the_user(self, client):
        user_id = signup(client).get_json()["id"]
        resp = client.get("/check_session")
        assert resp.status_code == 200
        assert resp.get_json() == {"id": user_id, "email": "pat@example.com"}
        assert_no_secrets(resp)

    def test_not_logged_in_is_401(self, client):
        resp = client.get("/check_session")
        assert resp.status_code == 401
        assert "error" in resp.get_json()

    def test_session_for_a_deleted_user_is_401(self, client, session):
        signup(client)
        session.delete(User.query.one())
        session.commit()
        assert client.get("/check_session").status_code == 401


# ---------- DELETE /logout ----------

class TestLogout:
    def test_returns_204_with_no_body_and_clears_the_session(self, client):
        signup(client)
        resp = client.delete("/logout")
        assert resp.status_code == 204
        assert resp.data == b""
        assert session_user_id(client) is None
        assert client.get("/check_session").status_code == 401

    def test_is_204_when_not_logged_in(self, client):
        assert client.delete("/logout").status_code == 204


def test_full_flow(client):
    assert signup(client).status_code == 201
    assert client.get("/check_session").status_code == 200
    assert client.delete("/logout").status_code == 204
    assert client.get("/check_session").status_code == 401
    assert login(client).status_code == 200
    assert client.get("/check_session").status_code == 200


# ---------- current_user() ----------

class TestCurrentUser:
    def test_none_without_a_session(self):
        with app.test_request_context():
            assert current_user() is None

    def test_returns_the_logged_in_user(self, session):
        user = make_user(session)
        with app.test_request_context():
            flask_session["user_id"] = user.id
            assert current_user() == user

    def test_none_for_a_user_that_no_longer_exists(self, session):
        with app.test_request_context():
            flask_session["user_id"] = 999
            assert current_user() is None

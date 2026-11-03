"""Day 2 Block A: User validations and constraints (email and password)."""

import pytest
from sqlalchemy.exc import IntegrityError

from config import bcrypt
from helpers import column, make_user, raw_insert
from models import User

# Two layers: @validates raises ValueError as soon as a bad value is assigned,
# and nullable=False / CHECK constraints make Postgres reject what slips past
# Python (IntegrityError on commit). raw_insert skips the validators on purpose,
# to prove the database backstop exists on its own.


class TestUserEmailValidation:
    def test_email_is_stripped_and_lowercased(self, session):
        user = make_user(session, email="  Pat.Smith@Example.COM  ")
        assert user.email == "pat.smith@example.com"

    def test_lowercased_email_is_what_gets_saved(self, session):
        user_id = make_user(session, email="Pat@Example.com").id
        session.expire_all()
        assert session.get(User, user_id).email == "pat@example.com"

    @pytest.mark.parametrize("bad", [
        "not-an-email",
        "pat@",
        "@example.com",
        "pat@example",
        "pat..smith@example.com",
        "pat@exa mple.com",
    ])
    def test_bad_email_raises_value_error_on_assignment(self, bad):
        with pytest.raises(ValueError):
            User(email=bad)

    @pytest.mark.parametrize("blank", ["", "   ", None])
    def test_email_is_required(self, blank):
        with pytest.raises(ValueError):
            User(email=blank)

    def test_reassigning_a_bad_email_raises(self, session):
        user = make_user(session)
        with pytest.raises(ValueError):
            user.email = "nope"
        assert user.email == "pat@example.com"

    def test_error_message_is_readable(self):
        with pytest.raises(ValueError) as exc:
            User(email="pat@")
        assert "@" in str(exc.value)

    def test_duplicate_email_in_another_case_is_rejected(self, session):
        make_user(session, email="pat@example.com")
        with pytest.raises(IntegrityError):
            make_user(session, email="PAT@Example.com")
        session.rollback()

    def test_email_column_is_not_nullable(self):
        assert column(User, "email").nullable is False

    def test_database_rejects_a_null_email(self, session):
        with pytest.raises(IntegrityError):
            raw_insert(session, User, email=None, password_hash="x")
        session.rollback()


class TestUserPasswordValidation:
    def test_eight_characters_is_enough(self, session):
        assert make_user(session, password="12345678").authenticate("12345678") is True

    def test_seven_characters_raises(self):
        user = User(email="pat@example.com")
        with pytest.raises(ValueError):
            user.password = "1234567"

    @pytest.mark.parametrize("blank", ["", None])
    def test_password_is_required(self, blank):
        user = User(email="pat@example.com")
        with pytest.raises(ValueError):
            user.password = blank

    def test_72_bytes_is_allowed(self, session):
        assert make_user(session, password="a" * 72).authenticate("a" * 72) is True

    def test_73_bytes_raises(self):
        user = User(email="pat@example.com")
        with pytest.raises(ValueError):
            user.password = "a" * 73

    def test_the_cap_counts_bytes_not_characters(self, session):
        # "é" is 2 bytes in UTF-8: 36 of them is 72 bytes (ok), 37 is 74 bytes (too long)
        assert make_user(session, password="é" * 36).authenticate("é" * 36) is True
        user = User(email="sam@example.com")
        with pytest.raises(ValueError):
            user.password = "é" * 37

    @pytest.mark.parametrize("bad", ["1234567", "a" * 73, "é" * 37])
    def test_bad_password_is_rejected_before_hashing(self, monkeypatch, bad):
        # bcrypt 5 raises its own ValueError past 72 bytes; the check must come first
        calls = []
        real = bcrypt.generate_password_hash
        monkeypatch.setattr(bcrypt, "generate_password_hash", lambda *a, **k: calls.append(a) or real(*a, **k))
        user = User(email="pat@example.com")
        with pytest.raises(ValueError):
            user.password = bad
        assert calls == []

    def test_a_rejected_password_keeps_the_old_one(self, session):
        user = make_user(session, password="password123")
        with pytest.raises(ValueError):
            user.password = "short"
        assert user.authenticate("password123") is True

    def test_password_is_not_stripped(self, session):
        user = make_user(session, password="  secret12  ")
        assert user.authenticate("  secret12  ") is True
        assert user.authenticate("secret12") is False

    def test_a_user_without_a_password_is_rejected_by_the_database(self, session):
        session.add(User(email="pat@example.com"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_password_hash_column_is_not_nullable(self):
        assert column(User, "password_hash").nullable is False

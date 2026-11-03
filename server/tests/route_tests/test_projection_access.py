"""Rules shared by the projection routes (api/projections.py): access and error shape."""

import pytest

from helpers import make_budget

ENDPOINTS = ["timeline", "monthly", "projection"]


@pytest.fixture
def budget(session, user_a):
    return make_budget(session, user_a)


@pytest.fixture
def their_budget(session, user_b):
    return make_budget(session, user_b, title="Theirs")


# ---------- access rules (all three endpoints) ----------

@pytest.mark.parametrize("endpoint", ENDPOINTS)
class TestAccess:
    def test_no_session_is_401(self, client, budget, endpoint):
        resp = client.get(f"/budgets/{budget.id}/{endpoint}")
        assert resp.status_code == 401
        assert "error" in resp.get_json()

    def test_missing_budget_is_404(self, client_a, endpoint):
        resp = client_a.get(f"/budgets/999999/{endpoint}")
        assert resp.status_code == 404
        assert "error" in resp.get_json()

    def test_another_users_budget_is_403(self, client_a, their_budget, endpoint):
        resp = client_a.get(f"/budgets/{their_budget.id}/{endpoint}")
        assert resp.status_code == 403
        assert "error" in resp.get_json()

    def test_ownership_is_checked_before_the_params(self, client_a, their_budget, endpoint):
        resp = client_a.get(f"/budgets/{their_budget.id}/{endpoint}", query_string={"start": "nope", "to": "nope"})
        assert resp.status_code == 403

    def test_unknown_params_are_ignored(self, client_a, budget, endpoint):
        resp = client_a.get(f"/budgets/{budget.id}/{endpoint}", query_string={"colour": "red", "to": "2030-01-01"})
        assert resp.status_code == 200


# ---------- error shape: {"errors": {param: [messages]}} ----------

@pytest.mark.parametrize("endpoint, param, params", [
    ("timeline", "start", {"start": "nope"}),
    ("timeline", "start", {"start": "1899-12-31"}),
    ("timeline", "end", {"start": "2026-11-02", "end": "2026-11-01"}),
    ("monthly", "start", {"start": "nope"}),
    ("monthly", "start", {"start": "1899-12"}),
    ("monthly", "months", {"months": "abc"}),
    ("monthly", "months", {"months": "0"}),
    ("projection", "to", {}),
    ("projection", "to", {"to": "nope"}),
    ("projection", "to", {"to": "2201-01-01"}),
    ("projection", "to", {"to": "2026-09-30"}),
])
def test_param_errors_are_lists_of_messages(client_a, budget, endpoint, param, params):
    resp = client_a.get(f"/budgets/{budget.id}/{endpoint}", query_string=params)
    assert resp.status_code == 422
    messages = resp.get_json()["errors"][param]
    assert isinstance(messages, list) and messages

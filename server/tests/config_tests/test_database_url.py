from config import database_url


def test_postgres_scheme_gets_the_psycopg2_driver():
    assert database_url("postgres://u:p@host:5432/db") == "postgresql+psycopg2://u:p@host:5432/db"


def test_postgresql_scheme_gets_the_psycopg2_driver():
    assert database_url("postgresql://u:p@host/db") == "postgresql+psycopg2://u:p@host/db"


def test_a_url_that_already_names_the_driver_is_unchanged():
    url = "postgresql+psycopg2:///check_n_balance"
    assert database_url(url) == url

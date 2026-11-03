from datetime import date, datetime

from dateutil.relativedelta import relativedelta
from flask import request
from marshmallow import ValidationError


def default_window():
    first = date.today().replace(day=1)
    last = first + relativedelta(months=6, days=-1)
    return first, last


def check_year(name, value):
    if not (1900 <= value.year <= 2200):
        raise ValidationError({name: [f"{name} year must be between 1900 and 2200"]})
    return value


def date_param(name, default):
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        value = datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({name: [f"{name} must be in YYYY-MM-DD format"]})
    return check_year(name, value)


def month_param(name, default):
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        value = datetime.strptime(raw, "%Y-%m").date()
    except ValueError:
        raise ValidationError({name: [f"{name} must be in YYYY-MM format"]})
    return check_year(name, value)


def months_param(name, default):
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValidationError({name: [f"{name} must be an integer"]})
    if not 1 <= value <= 24:
        raise ValidationError({name: [f"{name} must be between 1 and 24"]})
    return value

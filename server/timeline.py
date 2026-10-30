from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta


def occurrences(item, start, end):
    if item.unit == "once":
        return [item.start_date] if start <= item.start_date <= end else []

    stop = min(end, item.end_date) if item.end_date else end

    results = []
    k = 0
    while True:
        # Always offset from the original start_date, so Jan 31 -> Feb 28 -> Mar 31
        d = item.start_date + relativedelta(**{item.unit +"s": item.interval * k})
        if d > stop:
            return results
        if d >= start:
            results.append(d)
        k += 1


def build_timeline(items, start, end):
    entries = []
    for item in items:
        for d in occurrences(item, start, end):
            entries.append({"item_id": item.id, "name": item.name, "kind":item.kind, "amount": item.amount, "date": d})
    return sorted(entries, key=lambda e: (e["date"], e["name"]))
    


def monthly_totals(timeline, start, months):
    first = date(start.year, start.month, 1)

    rows = {}
    for m in range(months):
        key = (first + relativedelta(months=m)).strftime("%Y-%m")
        rows[key] = {"month": key, "income": Decimal("0"), "expenses": Decimal("0")}

    for e in timeline:
        row = rows.get(e["date"].strftime("%Y-%m"))
        if row is None:
            continue
        if e["kind"] == "income":
            row["income"] += e["amount"]
        else:
            row["expenses"] += e["amount"]

    for row in rows.values():
        row["net"] = row["income"] - row["expenses"]

    return list(rows.values())
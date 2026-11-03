"""Timeline engine: occurrences, build_timeline, monthly_totals (pure functions, no database)."""

from datetime import date
from decimal import Decimal

from models import CashFlowItem
from timeline import build_timeline, monthly_totals, occurrences


def make(unit="month", interval=1, start=date(2026, 1, 31), end_date=None,
         name="Rent", kind="expense", amount="1500.00", id=1):
    """An unsaved CashFlowItem; the timeline only reads its attributes."""
    return CashFlowItem(
        id=id, name=name, kind=kind, amount=Decimal(amount),
        start_date=start, end_date=end_date,
        interval=None if unit == "once" else interval, unit=unit,
    )


def entry(d, kind="income", amount="100.00", name="X", item_id=1):
    return {"item_id": item_id, "name": name, "kind": kind, "amount": Decimal(amount), "date": d}


# ---------- occurrences ----------

class TestOccurrences:
    def test_monthly_on_the_31st_clamps_and_does_not_drift(self):
        # rrule would skip Feb/Apr/Jun; stepping from the previous date would stick on the 28th
        assert occurrences(make(), date(2026, 1, 1), date(2026, 6, 30)) == [
            date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31),
            date(2026, 4, 30), date(2026, 5, 31), date(2026, 6, 30),
        ]

    def test_monthly_on_the_31st_hits_feb_29_in_a_leap_year(self):
        item = make(start=date(2028, 1, 31))
        assert occurrences(item, date(2028, 2, 1), date(2028, 2, 29)) == [date(2028, 2, 29)]

    def test_yearly_on_feb_29_returns_to_the_29th_in_the_next_leap_year(self):
        item = make(unit="year", start=date(2028, 2, 29))
        assert occurrences(item, date(2028, 1, 1), date(2032, 12, 31)) == [
            date(2028, 2, 29), date(2029, 2, 28), date(2030, 2, 28),
            date(2031, 2, 28), date(2032, 2, 29),
        ]

    def test_biweekly(self):
        item = make(unit="week", interval=2, start=date(2026, 10, 2))
        assert occurrences(item, date(2026, 10, 1), date(2026, 10, 31)) == [
            date(2026, 10, 2), date(2026, 10, 16), date(2026, 10, 30),
        ]

    def test_every_three_days(self):
        item = make(unit="day", interval=3, start=date(2026, 10, 1))
        assert occurrences(item, date(2026, 10, 1), date(2026, 10, 10)) == [
            date(2026, 10, 1), date(2026, 10, 4), date(2026, 10, 7), date(2026, 10, 10),
        ]

    def test_window_starting_mid_series_keeps_the_original_rhythm(self):
        item = make(unit="week", interval=2, start=date(2026, 1, 2))
        assert occurrences(item, date(2026, 10, 1), date(2026, 10, 31)) == [
            date(2026, 10, 9), date(2026, 10, 23),
        ]

    def test_window_ending_mid_series(self):
        assert occurrences(make(), date(2026, 1, 1), date(2026, 3, 15)) == [
            date(2026, 1, 31), date(2026, 2, 28),
        ]

    def test_window_edges_are_inclusive(self):
        item = make(start=date(2026, 1, 15))
        assert occurrences(item, date(2026, 2, 15), date(2026, 4, 15)) == [
            date(2026, 2, 15), date(2026, 3, 15), date(2026, 4, 15),
        ]

    def test_end_date_stops_the_series_inclusive(self):
        item = make(start=date(2026, 1, 15), end_date=date(2026, 3, 15))
        assert occurrences(item, date(2026, 1, 1), date(2026, 6, 30)) == [
            date(2026, 1, 15), date(2026, 2, 15), date(2026, 3, 15),
        ]

    def test_end_date_before_the_window_gives_nothing(self):
        item = make(start=date(2026, 1, 15), end_date=date(2026, 3, 15))
        assert occurrences(item, date(2026, 4, 1), date(2026, 6, 30)) == []

    def test_series_starting_after_the_window_gives_nothing(self):
        item = make(start=date(2027, 1, 15))
        assert occurrences(item, date(2026, 1, 1), date(2026, 12, 31)) == []

    def test_once_inside_the_window(self):
        item = make(unit="once", start=date(2026, 11, 20))
        assert occurrences(item, date(2026, 10, 1), date(2027, 3, 31)) == [date(2026, 11, 20)]

    def test_once_before_or_after_the_window_gives_nothing(self):
        window = (date(2026, 10, 1), date(2027, 3, 31))
        assert occurrences(make(unit="once", start=date(2026, 9, 30)), *window) == []
        assert occurrences(make(unit="once", start=date(2027, 4, 1)), *window) == []


# ---------- build_timeline ----------

class TestBuildTimeline:
    def test_entry_shape(self):
        item = make(unit="once", start=date(2026, 11, 20), name="Tires", amount="640.25", id=7)
        assert build_timeline([item], date(2026, 10, 1), date(2026, 12, 31)) == [{
            "item_id": 7, "name": "Tires", "kind": "expense",
            "amount": Decimal("640.25"), "date": date(2026, 11, 20),
        }]

    def test_one_entry_per_occurrence_across_items_sorted_by_date(self):
        rent = make(start=date(2026, 1, 1), name="Rent", id=1)
        pay = make(unit="week", interval=2, start=date(2026, 10, 2), name="Paycheck", kind="income", id=2)
        timeline = build_timeline([rent, pay], date(2026, 10, 1), date(2026, 10, 31))
        assert [(e["date"], e["name"]) for e in timeline] == [
            (date(2026, 10, 1), "Rent"),
            (date(2026, 10, 2), "Paycheck"),
            (date(2026, 10, 16), "Paycheck"),
            (date(2026, 10, 30), "Paycheck"),
        ]

    def test_same_day_entries_are_sorted_by_name(self):
        zeta = make(unit="once", start=date(2026, 10, 5), name="Zeta", id=1)
        alpha = make(unit="once", start=date(2026, 10, 5), name="Alpha", id=2)
        timeline = build_timeline([zeta, alpha], date(2026, 10, 1), date(2026, 10, 31))
        assert [e["name"] for e in timeline] == ["Alpha", "Zeta"]

    def test_no_items_gives_an_empty_timeline(self):
        assert build_timeline([], date(2026, 10, 1), date(2026, 10, 31)) == []


# ---------- monthly_totals ----------

class TestMonthlyTotals:
    def test_one_row_per_month_including_empty_months(self):
        rows = monthly_totals([], date(2026, 10, 15), 3)
        assert rows == [
            {"month": "2026-10", "income": 0, "expenses": 0, "net": 0},
            {"month": "2026-11", "income": 0, "expenses": 0, "net": 0},
            {"month": "2026-12", "income": 0, "expenses": 0, "net": 0},
        ]

    def test_months_roll_over_the_year_and_are_zero_padded(self):
        rows = monthly_totals([], date(2026, 11, 1), 4)
        assert [r["month"] for r in rows] == ["2026-11", "2026-12", "2027-01", "2027-02"]

    def test_income_and_expenses_are_summed_and_net_is_the_difference(self):
        timeline = [
            entry(date(2026, 10, 2), "income", "1200.50"),
            entry(date(2026, 10, 16), "income", "1200.50"),
            entry(date(2026, 10, 1), "expense", "1500.00"),
            entry(date(2026, 10, 20), "expense", "350.25"),
        ]
        [row] = monthly_totals(timeline, date(2026, 10, 1), 1)
        assert row["income"] == Decimal("2401.00")
        assert row["expenses"] == Decimal("1850.25")  # positive, the kind gives the sign
        assert row["net"] == Decimal("550.75")

    def test_net_can_be_negative(self):
        [row] = monthly_totals([entry(date(2026, 10, 1), "expense", "75.00")], date(2026, 10, 1), 1)
        assert row["net"] == Decimal("-75.00")

    def test_each_entry_lands_in_its_own_month(self):
        timeline = [
            entry(date(2026, 10, 31), "income", "10.00"),
            entry(date(2026, 11, 1), "income", "20.00"),
            entry(date(2026, 12, 15), "expense", "5.00"),
        ]
        rows = monthly_totals(timeline, date(2026, 10, 1), 3)
        assert [(r["income"], r["expenses"]) for r in rows] == [
            (Decimal("10.00"), 0), (Decimal("20.00"), 0), (0, Decimal("5.00")),
        ]

    def test_entries_outside_the_months_are_ignored(self):
        timeline = [
            entry(date(2026, 9, 30), "income", "999.00"),
            entry(date(2026, 10, 10), "income", "50.00"),
            entry(date(2026, 12, 1), "income", "999.00"),
        ]
        rows = monthly_totals(timeline, date(2026, 10, 1), 2)
        assert [r["income"] for r in rows] == [Decimal("50.00"), 0]

    def test_works_on_a_built_timeline(self):
        rent = make(start=date(2026, 1, 31), id=1)
        pay = make(unit="week", interval=2, start=date(2026, 10, 2), name="Paycheck",
                   kind="income", amount="1200.00", id=2)
        timeline = build_timeline([rent, pay], date(2026, 10, 1), date(2026, 11, 30))
        rows = monthly_totals(timeline, date(2026, 10, 1), 2)
        assert rows == [
            {"month": "2026-10", "income": Decimal("3600.00"), "expenses": Decimal("1500.00"), "net": Decimal("2100.00")},
            {"month": "2026-11", "income": Decimal("2400.00"), "expenses": Decimal("1500.00"), "net": Decimal("900.00")},
        ]

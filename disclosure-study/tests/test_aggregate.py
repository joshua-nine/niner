"""Tests for src/aggregate.py."""

from datetime import date

from src.aggregate import (
    aggregate_by_body,
    aggregate_by_filer,
    aggregate_overall,
    compute_median_excess_return,
    compute_win_rate,
)


def make_row(**overrides):
    row = {
        "filer_name": "Jane Doe",
        "body": "house",
        "ticker": "AAPL",
        "transaction_date": date(2021, 1, 5),
        "window_days": 30,
        "anchor": "transaction_date",
        "excess_return": 0.05,
    }
    row.update(overrides)
    return row


def test_median_excess_return_ignores_outliers_unlike_mean():
    # A single huge outlier would swing a mean far above every other value.
    returns = [0.01, 0.02, 0.015, 0.02, 5.0]

    median = compute_median_excess_return(returns)

    assert median == 0.02
    assert median < sum(returns) / len(returns)  # the mean would be dragged way up


def test_median_excess_return_ignores_nulls():
    assert compute_median_excess_return([0.1, None, 0.3, None]) == 0.2


def test_median_excess_return_none_when_all_null():
    assert compute_median_excess_return([None, None]) is None


def test_win_rate_computes_fraction_beating_benchmark():
    returns = [0.05, -0.02, 0.01, -0.10]

    assert compute_win_rate(returns) == 0.5


def test_win_rate_ignores_nulls():
    returns = [0.05, None, -0.02, None]

    assert compute_win_rate(returns) == 0.5


def test_win_rate_none_when_all_null():
    assert compute_win_rate([None, None]) is None


def test_aggregate_overall_groups_by_window_and_anchor():
    rows = [
        make_row(window_days=30, anchor="transaction_date", excess_return=0.10),
        make_row(window_days=30, anchor="transaction_date", excess_return=-0.05),
        make_row(window_days=90, anchor="disclosure_date", excess_return=0.02),
    ]

    result = aggregate_overall(rows)

    assert set(result) == {(30, "transaction_date"), (90, "disclosure_date")}
    group = result[(30, "transaction_date")]
    assert group["trade_count"] == 2
    assert group["missing_count"] == 0
    assert group["median_excess_return"] == pytest_approx(0.025)
    assert group["win_rate"] == 0.5


def test_aggregate_overall_reports_missing_count():
    rows = [
        make_row(excess_return=0.10),
        make_row(excess_return=None),
    ]

    result = aggregate_overall(rows)

    group = result[(30, "transaction_date")]
    assert group["trade_count"] == 2
    assert group["missing_count"] == 1
    assert group["median_excess_return"] == 0.10


def test_aggregate_by_body_splits_correctly():
    rows = [
        make_row(body="house", excess_return=0.10),
        make_row(body="house", excess_return=0.20),
        make_row(body="senate", excess_return=-0.05),
    ]

    result = aggregate_by_body(rows)

    assert set(result) == {"house", "senate"}
    assert result["house"][(30, "transaction_date")]["trade_count"] == 2
    assert result["senate"][(30, "transaction_date")]["trade_count"] == 1


def test_aggregate_by_filer_excludes_filers_below_min_trades():
    rows = []
    # Prolific Doe: 3 distinct trades (distinct ticker+transaction_date pairs)
    for i, ticker in enumerate(["AAPL", "MSFT", "GOOG"]):
        rows.append(
            make_row(
                filer_name="Prolific Doe",
                ticker=ticker,
                transaction_date=date(2021, 1, i + 1),
                excess_return=0.01 * (i + 1),
            )
        )
    # Occasional Roe: only 1 distinct trade
    rows.append(make_row(filer_name="Occasional Roe", ticker="TSLA", transaction_date=date(2021, 2, 1)))

    result = aggregate_by_filer(rows, min_trades=2)

    assert "Prolific Doe" in result
    assert "Occasional Roe" not in result


def test_aggregate_by_filer_counts_distinct_trades_not_rows():
    # Same trade appears twice (e.g. two different windows/anchors for one trade).
    rows = [
        make_row(filer_name="Jane Doe", ticker="AAPL", transaction_date=date(2021, 1, 5), window_days=30),
        make_row(filer_name="Jane Doe", ticker="AAPL", transaction_date=date(2021, 1, 5), window_days=90),
    ]

    # Only one distinct trade, so a threshold of 2 should exclude this filer.
    result = aggregate_by_filer(rows, min_trades=2)

    assert "Jane Doe" not in result


def pytest_approx(value, tol=1e-9):
    class _Approx:
        def __eq__(self, other):
            return abs(other - value) < tol

    return _Approx()

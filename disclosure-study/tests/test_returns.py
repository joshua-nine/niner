"""Tests for src/returns.py."""

from datetime import date

from src.returns import (
    compute_all_returns,
    compute_benchmark_return,
    compute_excess_return,
    compute_forward_return,
    compute_trade_returns,
    resolve_window,
)

# A trading calendar with a gap over a weekend (Sat Jan 9 / Sun Jan 10, 2021)
# and data ending on Jan 15, 2021.
TRADING_CALENDAR = [
    date(2021, 1, 4),
    date(2021, 1, 5),
    date(2021, 1, 6),
    date(2021, 1, 7),
    date(2021, 1, 8),
    date(2021, 1, 11),
    date(2021, 1, 12),
    date(2021, 1, 13),
    date(2021, 1, 14),
    date(2021, 1, 15),
]


def test_resolve_window_rolls_weekend_start_to_next_trading_day():
    # Jan 9, 2021 is a Saturday; the next trading day is Monday Jan 11.
    # A 2-day window from Jan 9 targets Jan 11, which is itself a trading day.
    start_date, end_date = resolve_window(date(2021, 1, 9), 2, TRADING_CALENDAR)

    assert start_date == date(2021, 1, 11)
    assert end_date == date(2021, 1, 11)


def test_resolve_window_returns_none_when_past_available_data():
    # A 30-day window from Jan 4 lands on Feb 3, far past the calendar's end.
    start_date, end_date = resolve_window(date(2021, 1, 4), 30, TRADING_CALENDAR)

    assert start_date == date(2021, 1, 4)
    assert end_date is None


def test_compute_forward_return_none_when_window_extends_past_data():
    prices = {"AAPL": {date(2021, 1, 4): 100.0}}

    result = compute_forward_return("AAPL", date(2021, 1, 4), None, prices)

    assert result is None


def test_compute_forward_return_computes_correctly():
    prices = {"AAPL": {date(2021, 1, 4): 100.0, date(2021, 1, 11): 110.0}}

    result = compute_forward_return("AAPL", date(2021, 1, 4), date(2021, 1, 11), prices)

    assert abs(result - 0.10) < 1e-9


def test_compute_forward_return_none_when_ticker_missing_from_lookup():
    prices = {"AAPL": {date(2021, 1, 4): 100.0, date(2021, 1, 11): 110.0}}

    assert compute_forward_return("MSFT", date(2021, 1, 4), date(2021, 1, 11), prices) is None


def test_compute_benchmark_return_none_when_edge_missing():
    benchmark_prices = {date(2021, 1, 4): 370.0}

    assert compute_benchmark_return(date(2021, 1, 4), None, benchmark_prices) is None


def test_compute_excess_return_none_if_either_side_missing():
    assert compute_excess_return(None, 0.05) is None
    assert compute_excess_return(0.05, None) is None
    assert abs(compute_excess_return(0.10, 0.04) - 0.06) < 1e-9


def test_excess_return_is_zero_when_ticker_is_benchmark():
    """If a filer's trade is in the benchmark ticker itself, the trade's
    return and the benchmark's return are identical, so excess_return must
    be exactly zero for every window and every anchor."""
    benchmark_prices = {
        date(2021, 1, 4): 370.0,
        date(2021, 1, 5): 372.0,
        date(2021, 2, 3): 380.0,
        date(2021, 4, 5): 390.0,
    }
    price_lookup = {"SPY": benchmark_prices}

    trade = {
        "filer_name": "Jane Doe",
        "body": "house",
        "ticker": "SPY",
        "transaction_date": date(2021, 1, 4),
        "disclosure_date": date(2021, 1, 5),
    }

    rows = compute_trade_returns(trade, price_lookup, benchmark_prices, windows=[30, 90])

    assert len(rows) == 4  # 2 anchors x 2 windows
    for row in rows:
        assert row["excess_return"] == 0.0


def test_compute_trade_returns_row_count_matches_anchors_times_windows():
    benchmark_prices = {d: 100.0 + i for i, d in enumerate(TRADING_CALENDAR)}
    price_lookup = {"AAPL": {d: 200.0 + i for i, d in enumerate(TRADING_CALENDAR)}}

    trade = {
        "filer_name": "Jane Doe",
        "body": "house",
        "ticker": "AAPL",
        "transaction_date": date(2021, 1, 4),
        "disclosure_date": date(2021, 1, 5),
    }

    rows = compute_trade_returns(trade, price_lookup, benchmark_prices, windows=[1, 2, 3])

    assert len(rows) == 6  # 2 anchors x 3 windows
    anchors = {row["anchor"] for row in rows}
    assert anchors == {"transaction_date", "disclosure_date"}


def test_compute_all_returns_flattens_across_trades():
    benchmark_prices = {d: 100.0 for d in TRADING_CALENDAR}
    price_lookup = {"AAPL": {d: 200.0 for d in TRADING_CALENDAR}}

    trades = [
        {
            "filer_name": "Jane Doe",
            "body": "house",
            "ticker": "AAPL",
            "transaction_date": date(2021, 1, 4),
            "disclosure_date": date(2021, 1, 5),
        },
        {
            "filer_name": "John Roe",
            "body": "senate",
            "ticker": "AAPL",
            "transaction_date": date(2021, 1, 5),
            "disclosure_date": date(2021, 1, 6),
        },
    ]

    rows = compute_all_returns(trades, price_lookup, benchmark_prices, windows=[1, 2])

    assert len(rows) == 8  # 2 trades x 2 anchors x 2 windows

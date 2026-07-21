"""Compute excess returns vs. the benchmark for each trade, from two reference dates.

For each trade and each holding window in HOLDING_WINDOWS, this computes the
return from (a) the transaction date and (b) the public disclosure date,
each measured against the benchmark (SPY) return over the SAME calendar
window. A window's start/end are always resolved once, from the benchmark's
own trading calendar, and then reused for both the ticker and the benchmark
return -- this guarantees the two returns are never measured over mismatched
periods. If either edge of a window falls after the end of available price
data, the window is never truncated -- it's simply marked null (None).

Amounts are disclosed as ranges, not exact values, so only direction/timing
of returns is meaningful here -- not position-sized or dollar P&L.
"""

import bisect
import csv
import logging
from datetime import date, timedelta
from pathlib import Path

from config.settings import BENCHMARK, HOLDING_WINDOWS
from src.clean import CLEANED_TRADES_PATH
from src.fetch_prices import get_benchmark_prices, get_cached_prices

logger = logging.getLogger(__name__)

RETURNS_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "returns.csv"

FIELDNAMES = [
    "filer_name",
    "body",
    "ticker",
    "transaction_date",
    "disclosure_date",
    "anchor",
    "anchor_date",
    "window_days",
    "start_date",
    "end_date",
    "ticker_return",
    "benchmark_return",
    "excess_return",
]


def _next_trading_day(target_date, trading_calendar):
    """Return the first date in trading_calendar (sorted) on or after
    target_date, or None if target_date falls after the calendar's end."""
    idx = bisect.bisect_left(trading_calendar, target_date)
    if idx >= len(trading_calendar):
        return None
    return trading_calendar[idx]


def resolve_window(reference_date, window_days, trading_calendar):
    """Resolve the (start_date, end_date) trading days for a window that
    starts at reference_date and spans window_days calendar days, rolling
    a weekend/holiday forward to the next trading day per trading_calendar.

    Either edge is None if it falls beyond the available trading_calendar --
    callers must treat that as "extends past available data," never
    truncating the window to whatever data happens to exist.
    """
    start_date = _next_trading_day(reference_date, trading_calendar)
    end_date = _next_trading_day(reference_date + timedelta(days=window_days), trading_calendar)
    return start_date, end_date


def compute_forward_return(ticker, start_date, end_date, prices):
    """Compute a ticker's return between two already-resolved trading dates.

    `prices` is a {ticker: {date: close}} lookup. Returns None if either
    edge is None, or the ticker has no cached close on one of those exact
    dates (e.g. it wasn't trading yet, or its price history doesn't cover it).
    """
    if start_date is None or end_date is None:
        return None
    series = prices.get(ticker)
    if not series:
        return None
    start_close = series.get(start_date)
    end_close = series.get(end_date)
    if start_close is None or end_close is None:
        return None
    return (end_close / start_close) - 1.0


def compute_benchmark_return(start_date, end_date, benchmark_prices):
    """Compute the benchmark's return between two already-resolved trading dates."""
    if start_date is None or end_date is None:
        return None
    start_close = benchmark_prices.get(start_date)
    end_close = benchmark_prices.get(end_date)
    if start_close is None or end_close is None:
        return None
    return (end_close / start_close) - 1.0


def compute_excess_return(ticker_return, benchmark_return):
    """Compute a trade's excess return over the benchmark. Returns None if
    either return is missing, so a partial/mismatched comparison is never
    reported as a real number."""
    if ticker_return is None or benchmark_return is None:
        return None
    return ticker_return - benchmark_return


def compute_trade_returns(trade, prices, benchmark_prices, windows=HOLDING_WINDOWS):
    """Compute excess returns for a single trade from both the
    transaction_date and disclosure_date, for each configured holding window.

    Returns a list of row dicts, one per (anchor, window) combination.
    """
    trading_calendar = sorted(benchmark_prices)
    anchors = (
        ("transaction_date", trade["transaction_date"]),
        ("disclosure_date", trade["disclosure_date"]),
    )

    rows = []
    for anchor_name, anchor_date in anchors:
        for window_days in windows:
            start_date, end_date = resolve_window(anchor_date, window_days, trading_calendar)
            ticker_return = compute_forward_return(trade["ticker"], start_date, end_date, prices)
            benchmark_return = compute_benchmark_return(start_date, end_date, benchmark_prices)
            excess_return = compute_excess_return(ticker_return, benchmark_return)
            rows.append(
                {
                    "filer_name": trade["filer_name"],
                    "body": trade["body"],
                    "ticker": trade["ticker"],
                    "transaction_date": trade["transaction_date"],
                    "disclosure_date": trade["disclosure_date"],
                    "anchor": anchor_name,
                    "anchor_date": anchor_date,
                    "window_days": window_days,
                    "start_date": start_date,
                    "end_date": end_date,
                    "ticker_return": ticker_return,
                    "benchmark_return": benchmark_return,
                    "excess_return": excess_return,
                }
            )
    return rows


def compute_all_returns(trades, price_lookup, benchmark_prices, windows=HOLDING_WINDOWS):
    """Compute excess returns for every trade in the cleaned trade set."""
    rows = []
    for trade in trades:
        rows.extend(compute_trade_returns(trade, price_lookup, benchmark_prices, windows))
    return rows


def _load_cleaned_trades(source=CLEANED_TRADES_PATH):
    with open(source, newline="") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        row["transaction_date"] = date.fromisoformat(row["transaction_date"])
        row["disclosure_date"] = date.fromisoformat(row["disclosure_date"])
    return rows


def _build_price_lookup(tickers):
    lookup = {}
    for ticker in tickers:
        prices = get_cached_prices(ticker)
        if prices:
            lookup[ticker] = prices
    return lookup


def save_returns(rows, destination=RETURNS_PATH):
    """Write computed return rows to a CSV file at `destination`."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with open(destination, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for row in rows:
            serialized = dict(row)
            for date_field in ("transaction_date", "disclosure_date", "anchor_date", "start_date", "end_date"):
                value = serialized.get(date_field)
                serialized[date_field] = value.isoformat() if isinstance(value, date) else ""
            writer.writerow(serialized)
    return destination


def main():
    """Load cleaned trades and prices, compute returns, and save the results."""
    logging.basicConfig(level=logging.INFO)

    trades = _load_cleaned_trades()
    tickers = {trade["ticker"] for trade in trades}
    price_lookup = _build_price_lookup(tickers)
    benchmark_prices = get_cached_prices(BENCHMARK) or {}

    rows = compute_all_returns(trades, price_lookup, benchmark_prices)
    destination = save_returns(rows)
    logger.info("Wrote %d return rows to %s", len(rows), destination)


if __name__ == "__main__":
    main()

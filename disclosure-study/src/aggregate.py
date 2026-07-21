"""Aggregate trade-level excess returns into summary statistics.

Produces medians (never means -- a handful of outlier trades can swing an
average) and win rates, per holding window and reference-date anchor, both
overall and split by disclosure body and by individual filer (subject to
MIN_TRADES_PER_FILER).
"""

import csv
import logging
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path

from config.settings import MIN_TRADES_PER_FILER
from src.returns import RETURNS_PATH

logger = logging.getLogger(__name__)


def compute_median_excess_return(returns):
    """Compute the median excess return across a set of trade returns,
    ignoring nulls. Returns None if every value is null."""
    values = [r for r in returns if r is not None]
    if not values:
        return None
    return statistics.median(values)


def compute_win_rate(returns):
    """Compute the fraction of non-null trade returns that beat the
    benchmark (excess_return > 0). Returns None if every value is null."""
    values = [r for r in returns if r is not None]
    if not values:
        return None
    wins = sum(1 for r in values if r > 0)
    return wins / len(values)


def _group_stats(rows):
    """Build one summary dict (median, win rate, counts) from a list of
    return rows that share the same grouping key."""
    excess_returns = [row["excess_return"] for row in rows]
    non_null_count = sum(1 for r in excess_returns if r is not None)
    return {
        "trade_count": len(rows),
        "missing_count": len(rows) - non_null_count,
        "median_excess_return": compute_median_excess_return(excess_returns),
        "win_rate": compute_win_rate(excess_returns),
    }


def _group_by(rows, key_fn):
    groups = defaultdict(list)
    for row in rows:
        groups[key_fn(row)].append(row)
    return groups


def aggregate_overall(returns):
    """Compute overall medians and win rates, keyed by (window_days, anchor)."""
    groups = _group_by(returns, lambda row: (row["window_days"], row["anchor"]))
    return {key: _group_stats(rows) for key, rows in groups.items()}


def aggregate_by_body(returns):
    """Compute medians and win rates split by disclosure body, keyed as
    {body: {(window_days, anchor): stats}}."""
    result = {}
    for body, body_rows in _group_by(returns, lambda row: row["body"]).items():
        result[body] = aggregate_overall(body_rows)
    return result


def aggregate_by_filer(returns, min_trades=MIN_TRADES_PER_FILER):
    """Compute medians and win rates split by filer, excluding filers with
    fewer than min_trades distinct qualifying trades. Keyed as
    {filer_name: {(window_days, anchor): stats}}."""
    result = {}
    for filer_name, filer_rows in _group_by(returns, lambda row: row["filer_name"]).items():
        trade_count = len({(row["ticker"], row["transaction_date"]) for row in filer_rows})
        if trade_count < min_trades:
            continue
        result[filer_name] = aggregate_overall(filer_rows)
    return result


def _load_returns(source=RETURNS_PATH):
    with open(source, newline="") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        row["window_days"] = int(row["window_days"])
        row["transaction_date"] = date.fromisoformat(row["transaction_date"])
        row["disclosure_date"] = date.fromisoformat(row["disclosure_date"])
        for date_field in ("anchor_date", "start_date", "end_date"):
            row[date_field] = date.fromisoformat(row[date_field]) if row[date_field] else None
        for float_field in ("ticker_return", "benchmark_return", "excess_return"):
            row[float_field] = float(row[float_field]) if row[float_field] != "" else None
    return rows


def main():
    """Load computed returns and produce all aggregation views."""
    logging.basicConfig(level=logging.INFO)

    returns = _load_returns()
    overall = aggregate_overall(returns)
    by_body = aggregate_by_body(returns)
    by_filer = aggregate_by_filer(returns)

    logger.info("Aggregated %d return rows", len(returns))
    logger.info("Overall groups: %d", len(overall))
    logger.info("Body groups: %d", len(by_body))
    logger.info("Filers meeting MIN_TRADES_PER_FILER: %d", len(by_filer))

    return overall, by_body, by_filer


if __name__ == "__main__":
    main()

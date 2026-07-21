"""Clean normalized filing rows: dedupe, drop non-purchase trades, flag bad tickers.

This study only concerns official stock PURCHASES, so sells and exchanges are
dropped. Every rule below logs a count of the rows it affected, and
clean_trades() prints a rows-in/rows-out summary across all rules.
"""

import csv
import logging
import re
from datetime import date
from pathlib import Path

from src.fetch_filings import FIELDNAMES, NORMALIZED_TRADES_PATH

logger = logging.getLogger(__name__)

# Convention shared with fetch_prices.py: cached daily prices for a ticker are
# stored at data/prices/{TICKER}.csv. A ticker with no such file has no known
# price history (e.g. delisted or acquired) as far as this study can tell.
PRICES_DIR = Path(__file__).resolve().parent.parent / "data" / "prices"

CLEANED_TRADES_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "cleaned_trades.csv"

_TICKER_RE = re.compile(r"^[A-Z]{1,5}(\.[A-Z]{1,2})?$")


def _is_valid_ticker(ticker):
    return bool(ticker) and bool(_TICKER_RE.match(ticker))


def has_price_history(ticker, price_dir=PRICES_DIR):
    """Return True if cached price data exists for `ticker` in `price_dir`."""
    if not ticker:
        return False
    return (Path(price_dir) / f"{ticker}.csv").exists()


def drop_non_purchases(rows):
    """Rule 1: keep purchases only; drop sells and exchanges.

    Returns (kept_rows, removed_count).
    """
    kept = [row for row in rows if row.get("transaction_type") == "purchase"]
    removed = len(rows) - len(kept)
    logger.info("drop_non_purchases: removed %d non-purchase rows", removed)
    return kept, removed


def dedupe_trades(rows):
    """Rule 2: collapse rows sharing the same filer + ticker + transaction_date
    (e.g. the same trade filed separately for self/spouse/joint accounts) into
    a single row. The first row seen for a given key is kept.

    Returns (kept_rows, removed_count).
    """
    seen = set()
    kept = []
    for row in rows:
        key = (row.get("filer_name"), row.get("ticker"), row.get("transaction_date"))
        if key in seen:
            continue
        seen.add(key)
        kept.append(row)
    removed = len(rows) - len(kept)
    logger.info("dedupe_trades: collapsed %d duplicate rows", removed)
    return kept, removed


def drop_bad_tickers(rows):
    """Rule 3: drop rows with unparseable or missing tickers.

    Returns (kept_rows, removed_count).
    """
    kept = [row for row in rows if _is_valid_ticker(row.get("ticker"))]
    removed = len(rows) - len(kept)
    logger.info("drop_bad_tickers: removed %d rows with missing/unparseable tickers", removed)
    return kept, removed


def flag_missing_or_delisted_tickers(rows, price_dir=PRICES_DIR):
    """Rule 4: flag (do not drop) rows whose ticker has no cached price
    history, since dropping them would bias results toward survivors.

    Annotates each row with a "no_price_history" boolean.
    Returns (rows, flagged_count).
    """
    flagged = 0
    for row in rows:
        missing = not has_price_history(row.get("ticker"), price_dir)
        row["no_price_history"] = missing
        if missing:
            flagged += 1
    logger.info("flag_missing_or_delisted_tickers: flagged %d rows with no price history", flagged)
    return rows, flagged


def drop_bad_date_order(rows):
    """Rule 5: drop rows where disclosure_date < transaction_date (data errors).

    Returns (kept_rows, removed_count).
    """
    kept = [row for row in rows if row.get("disclosure_date") >= row.get("transaction_date")]
    removed = len(rows) - len(kept)
    logger.info("drop_bad_date_order: removed %d rows with disclosure_date before transaction_date", removed)
    return kept, removed


def clean_trades(rows, price_dir=PRICES_DIR):
    """Run the full cleaning pipeline in order: drop non-purchases, dedupe,
    drop bad tickers, flag missing price history, drop bad date order.

    Returns (cleaned_rows, summary) where summary is a dict of counts:
    rows_in, dropped_non_purchase, dropped_duplicate, dropped_bad_ticker,
    flagged_no_price_history, dropped_bad_date_order, rows_out.
    """
    rows_in = len(rows)

    rows, dropped_non_purchase = drop_non_purchases(rows)
    rows, dropped_duplicate = dedupe_trades(rows)
    rows, dropped_bad_ticker = drop_bad_tickers(rows)
    rows, flagged_no_price_history = flag_missing_or_delisted_tickers(rows, price_dir=price_dir)
    rows, dropped_bad_date_order = drop_bad_date_order(rows)

    summary = {
        "rows_in": rows_in,
        "dropped_non_purchase": dropped_non_purchase,
        "dropped_duplicate": dropped_duplicate,
        "dropped_bad_ticker": dropped_bad_ticker,
        "flagged_no_price_history": flagged_no_price_history,
        "dropped_bad_date_order": dropped_bad_date_order,
        "rows_out": len(rows),
    }
    return rows, summary


def print_summary(summary):
    """Print a rows-in/rows-removed-per-rule/rows-out summary."""
    print("Cleaning summary:")
    print(f"  rows in:                         {summary['rows_in']}")
    print(f"  removed (non-purchase):          {summary['dropped_non_purchase']}")
    print(f"  removed (duplicate):             {summary['dropped_duplicate']}")
    print(f"  removed (missing/bad ticker):    {summary['dropped_bad_ticker']}")
    print(f"  flagged (no price history):      {summary['flagged_no_price_history']}")
    print(f"  removed (bad date order):        {summary['dropped_bad_date_order']}")
    print(f"  rows out:                        {summary['rows_out']}")


def _load_normalized_trades(source=NORMALIZED_TRADES_PATH):
    with open(source, newline="") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        row["transaction_date"] = date.fromisoformat(row["transaction_date"])
        row["disclosure_date"] = date.fromisoformat(row["disclosure_date"])
        for amount_field in ("amount_range_low", "amount_range_high"):
            row[amount_field] = float(row[amount_field]) if row[amount_field] else None
    return rows


def _save_cleaned_trades(rows, destination=CLEANED_TRADES_PATH):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = FIELDNAMES + ["no_price_history"]
    with open(destination, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            serialized = dict(row)
            for date_field in ("transaction_date", "disclosure_date"):
                value = serialized.get(date_field)
                if isinstance(value, date):
                    serialized[date_field] = value.isoformat()
            writer.writerow(serialized)
    return destination


def main():
    """Load normalized filings, clean them, print the summary, and save the
    cleaned trade set."""
    logging.basicConfig(level=logging.INFO)
    rows = _load_normalized_trades()
    cleaned_rows, summary = clean_trades(rows)
    print_summary(summary)
    destination = _save_cleaned_trades(cleaned_rows)
    logger.info("Wrote %d cleaned trade rows to %s", len(cleaned_rows), destination)


if __name__ == "__main__":
    main()

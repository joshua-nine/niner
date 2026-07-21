"""Entry point: run the full disclosure-study pipeline end to end.

Pipeline stages: fetch_filings -> fetch_prices -> clean -> returns -> aggregate -> report.

Prices are fetched before cleaning on purpose: clean.py flags trades whose
ticker has no price history by checking the on-disk price cache, so that
cache has to be populated first.
"""

import logging
from datetime import date, timedelta

import requests

from config.settings import (
    BENCHMARK,
    END_DATE,
    HOLDING_WINDOWS,
    MIN_TRADES_PER_FILER,
    START_DATE,
)
from src import aggregate, clean, fetch_filings, fetch_prices, report, returns

logger = logging.getLogger(__name__)


def _spy_total_return(benchmark_prices, start_date, end_date):
    """Return the benchmark's total return from the first trading day on or
    after start_date to the last trading day on or before end_date, plus the
    two dates actually used. Returns (None, None, None) if the series is empty."""
    trading_days = sorted(d for d in benchmark_prices if start_date <= d <= end_date)
    if len(trading_days) < 2:
        return None, None, None
    first, last = trading_days[0], trading_days[-1]
    total_return = (benchmark_prices[last] / benchmark_prices[first]) - 1.0
    return total_return, first, last


def run_pipeline():
    """Run all pipeline stages in order and produce the final study outputs.

    Returns (csv_path, md_path) for the written reports.
    """
    start = date.fromisoformat(START_DATE)
    end = date.fromisoformat(END_DATE)
    # Prices must extend far enough past the last transaction to cover the
    # longest holding window (plus slack for weekends/holidays).
    price_end = end + timedelta(days=max(HOLDING_WINDOWS) + 10)

    session = requests.Session()

    # 1. Fetch and normalize filings.
    raw_filings = fetch_filings.fetch_raw_filings(session=session)
    filings_pulled = len(raw_filings)
    normalized = fetch_filings.normalize_filings(raw_filings)
    fetch_filings.save_normalized_filings(normalized)
    logger.info("Pulled %d filings; %d normalized trades in range", filings_pulled, len(normalized))

    # 2. Fetch prices for every valid ticker (+ benchmark) so clean.py can
    #    flag those with no price history. Invalid tickers are skipped to
    #    avoid pointless requests; they'll be dropped during cleaning anyway.
    tickers = {row["ticker"] for row in normalized if clean._is_valid_ticker(row["ticker"])}
    tickers.add(BENCHMARK)
    for ticker in sorted(tickers):
        prices = fetch_prices.get_prices(ticker, start, price_end, session=session)
        logger.info("%s: %d cached daily closes", ticker, len(prices))

    # 3. Clean.
    cleaned, clean_summary = clean.clean_trades(normalized)
    clean.print_summary(clean_summary)
    clean._save_cleaned_trades(cleaned)
    tickers_no_price = len({row["ticker"] for row in cleaned if row.get("no_price_history")})

    # 4. Returns.
    price_lookup = returns._build_price_lookup({row["ticker"] for row in cleaned})
    benchmark_prices = fetch_prices.get_cached_prices(BENCHMARK) or {}
    return_rows = returns.compute_all_returns(cleaned, price_lookup, benchmark_prices)
    returns.save_returns(return_rows)
    logger.info("Computed %d return rows", len(return_rows))

    # 5. Aggregate.
    aggregates = {
        "overall": aggregate.aggregate_overall(return_rows),
        "by_body": aggregate.aggregate_by_body(return_rows),
        "by_filer": aggregate.aggregate_by_filer(return_rows),
    }

    # 6. Report.
    spy_return, spy_start, spy_end = _spy_total_return(benchmark_prices, start, end)
    study_summary = {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "body": fetch_filings.BODY,
        "windows": HOLDING_WINDOWS,
        "min_trades_per_filer": MIN_TRADES_PER_FILER,
        "filings_pulled": filings_pulled,
        "clean_summary": clean_summary,
        "tickers_no_price": tickers_no_price,
        "spy_total_return": spy_return,
        "spy_start_date": spy_start.isoformat() if spy_start else "n/a",
        "spy_end_date": spy_end.isoformat() if spy_end else "n/a",
    }
    csv_path, md_path = report.write_reports(study_summary, aggregates)
    logger.info("Wrote reports: %s, %s", csv_path, md_path)
    return csv_path, md_path


def main():
    """CLI entry point for running the pipeline."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    csv_path, md_path = run_pipeline()
    print(f"\nResults written to:\n  {csv_path}\n  {md_path}")


if __name__ == "__main__":
    main()

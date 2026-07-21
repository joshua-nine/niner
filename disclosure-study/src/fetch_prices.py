"""Fetch and cache daily closing prices for traded tickers and the benchmark.

Prices are cached under data/prices/ as one CSV per ticker (date,close), so
repeated runs don't re-download data that's already on disk. This is also
the convention clean.py relies on when checking has_price_history().
"""

import calendar
import csv
import logging
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

from config.settings import BENCHMARK, END_DATE, HOLDING_WINDOWS, START_DATE
from src.fetch_filings import NORMALIZED_TRADES_PATH

logger = logging.getLogger(__name__)

PRICES_DIR = Path(__file__).resolve().parent.parent / "data" / "prices"

CHART_URL_TEMPLATE = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
REQUEST_DELAY_SECONDS = 1.0
_HEADERS = {"User-Agent": "disclosure-study research script"}

# Tracks when the last HTTP request went out, so requests stay spaced apart
# even across repeated calls within a process.
_last_request_time = 0.0


def _rate_limited_get(session, url, params, delay_seconds=REQUEST_DELAY_SECONDS, timeout=30):
    """GET a URL, sleeping first if needed to keep requests at least
    delay_seconds apart. Keeps polling of the price source polite."""
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    wait = delay_seconds - elapsed
    if wait > 0:
        time.sleep(wait)
    try:
        return session.get(url, params=params, headers=_HEADERS, timeout=timeout)
    finally:
        _last_request_time = time.monotonic()


def _cache_path(ticker):
    return PRICES_DIR / f"{ticker}.csv"


def _yahoo_symbol(ticker):
    """Yahoo Finance uses a hyphen for share-class tickers (e.g. BRK.B -> BRK-B)."""
    return ticker.replace(".", "-")


def _epoch_seconds(day):
    return calendar.timegm(datetime(day.year, day.month, day.day).timetuple())


def get_cached_prices(ticker):
    """Return cached {date: close} price data for ticker, or None if not cached."""
    path = _cache_path(ticker)
    if not path.exists():
        return None
    prices = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            prices[date.fromisoformat(row["date"])] = float(row["close"])
    return prices


def download_prices(ticker, start_date, end_date, session=None):
    """Download daily closing prices for ticker from Yahoo Finance's chart
    API over [start_date, end_date]. Returns {} (rather than raising) if the
    symbol has no data at all, e.g. it's delisted, acquired, or never listed.
    """
    session = session or requests.Session()
    url = CHART_URL_TEMPLATE.format(symbol=_yahoo_symbol(ticker))
    params = {
        "period1": _epoch_seconds(start_date),
        "period2": _epoch_seconds(end_date + timedelta(days=1)),
        "interval": "1d",
    }

    response = _rate_limited_get(session, url, params)
    if response.status_code == 404:
        logger.warning("No price data for ticker=%s (possibly delisted/acquired)", ticker)
        return {}
    response.raise_for_status()

    result = (response.json().get("chart") or {}).get("result")
    if not result:
        logger.warning("No price data for ticker=%s", ticker)
        return {}

    result = result[0]
    timestamps = result.get("timestamp") or []
    closes = result["indicators"]["quote"][0].get("close") or []

    prices = {}
    for timestamp, close in zip(timestamps, closes):
        if close is None:
            continue
        prices[datetime.utcfromtimestamp(timestamp).date()] = float(close)
    return prices


def cache_prices(ticker, price_data):
    """Write {date: close} price data for ticker to the local cache under data/prices/."""
    PRICES_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(ticker)
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "close"])
        for day in sorted(price_data):
            writer.writerow([day.isoformat(), price_data[day]])
    return path


def get_prices(ticker, start_date, end_date, session=None):
    """Return daily closing prices for a ticker, using the cache when available
    and downloading + caching any missing data."""
    cached = get_cached_prices(ticker)
    if cached is not None:
        return cached

    downloaded = download_prices(ticker, start_date, end_date, session=session)
    if downloaded:
        cache_prices(ticker, downloaded)
    return downloaded


def get_benchmark_prices(start_date, end_date, benchmark=BENCHMARK, session=None):
    """Return daily closing prices for the benchmark ticker."""
    return get_prices(benchmark, start_date, end_date, session=session)


def _load_unique_tickers(source=NORMALIZED_TRADES_PATH):
    tickers = set()
    with open(source, newline="") as f:
        for row in csv.DictReader(f):
            ticker = (row.get("ticker") or "").strip().upper()
            if ticker:
                tickers.add(ticker)
    return tickers


def main():
    """Fetch and cache prices for all tickers referenced by the study's filings,
    plus the benchmark, over the configured date range extended far enough
    forward to cover the longest holding window."""
    logging.basicConfig(level=logging.INFO)

    start = date.fromisoformat(START_DATE)
    end = date.fromisoformat(END_DATE) + timedelta(days=max(HOLDING_WINDOWS) + 10)

    tickers = _load_unique_tickers() | {BENCHMARK}
    session = requests.Session()
    for ticker in sorted(tickers):
        prices = get_prices(ticker, start, end, session=session)
        logger.info("%s: %d cached daily closes", ticker, len(prices))


if __name__ == "__main__":
    main()

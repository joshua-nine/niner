"""Fetch and cache daily closing prices for traded tickers and the benchmark.

Prices are cached under data/prices/ so repeated runs don't re-download data
that's already on disk.
"""

from config.settings import BENCHMARK


def get_cached_prices(ticker):
    """Return cached daily price data for a ticker, or None if not cached."""
    raise NotImplementedError


def download_prices(ticker, start_date, end_date):
    """Download daily closing prices for a ticker over the given date range."""
    raise NotImplementedError


def cache_prices(ticker, price_data):
    """Write price data for a ticker to the local cache under data/prices/."""
    raise NotImplementedError


def get_prices(ticker, start_date, end_date):
    """Return daily closing prices for a ticker, using the cache when available
    and downloading + caching any missing data."""
    raise NotImplementedError


def get_benchmark_prices(start_date, end_date, benchmark=BENCHMARK):
    """Return daily closing prices for the benchmark ticker."""
    raise NotImplementedError


def main():
    """Fetch and cache prices for all tickers referenced by the study's filings."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

"""Study-wide configuration: date range, disclosure source, thresholds, and holding windows."""

# Inclusive date range (transaction date) for filings pulled into the study.
START_DATE = "2020-01-01"
END_DATE = "2025-12-31"

# Disclosure source/body to study. Must be a key in DISCLOSURE_SOURCES below.
BODY = "house"

# Unofficial public mirrors of periodic transaction report filings, keyed by body.
DISCLOSURE_SOURCES = {
    "house": "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
    "senate": "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json",
}

# Minimum seconds between successive HTTP requests to a disclosure source.
REQUEST_DELAY_SECONDS = 1.0

# Holding periods, in calendar days, over which excess return vs. BENCHMARK is measured.
HOLDING_WINDOWS = [30, 90, 180]

# Minimum number of trades a filer must have in the study window to be included
# in per-filer aggregations.
MIN_TRADES_PER_FILER = 10

# Ticker used as the market benchmark for excess-return calculations.
BENCHMARK = "SPY"

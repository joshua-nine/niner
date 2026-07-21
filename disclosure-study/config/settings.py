"""Study-wide configuration: date range, disclosure source, thresholds, and holding windows."""

# Inclusive date range (transaction date) for filings pulled into the study.
START_DATE = None
END_DATE = None

# Disclosure source/body to study (e.g. a specific regulatory filing system).
BODY = None

# Holding periods, in calendar days, over which excess return vs. BENCHMARK is measured.
HOLDING_WINDOWS = [30, 90, 180]

# Minimum number of trades a filer must have in the study window to be included
# in per-filer aggregations.
MIN_TRADES_PER_FILER = 10

# Ticker used as the market benchmark for excess-return calculations.
BENCHMARK = "SPY"

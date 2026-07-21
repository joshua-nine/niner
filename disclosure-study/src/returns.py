"""Compute excess returns vs. the benchmark for each trade, from two reference dates.

For each trade and each holding window in HOLDING_WINDOWS, this computes the
return from (a) the transaction date and (b) the public disclosure date,
each measured against the benchmark (SPY) return over the same window.

Amounts are disclosed as ranges, not exact values, so only direction/timing
of returns is meaningful here — not position-sized or dollar P&L.
"""

from config.settings import HOLDING_WINDOWS, BENCHMARK


def compute_forward_return(ticker, reference_date, window_days, prices):
    """Compute the ticker's return from reference_date over window_days."""
    raise NotImplementedError


def compute_benchmark_return(reference_date, window_days, benchmark_prices):
    """Compute the benchmark's return from reference_date over window_days."""
    raise NotImplementedError


def compute_excess_return(ticker_return, benchmark_return):
    """Compute excess return of a trade's ticker over the benchmark."""
    raise NotImplementedError


def compute_trade_returns(trade, prices, benchmark_prices, windows=HOLDING_WINDOWS):
    """Compute excess returns for a single trade from both the transaction_date
    and disclosure_date, for each configured holding window."""
    raise NotImplementedError


def compute_all_returns(trades, price_lookup, benchmark_prices, windows=HOLDING_WINDOWS):
    """Compute excess returns for every trade in the cleaned trade set."""
    raise NotImplementedError


def main():
    """Load cleaned trades and prices, compute returns, and save the results."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

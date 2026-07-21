"""Aggregate trade-level excess returns into summary statistics.

Produces medians and win rates overall, and split by disclosure body and by
individual filer (subject to MIN_TRADES_PER_FILER).
"""

from config.settings import MIN_TRADES_PER_FILER


def compute_median_excess_return(returns):
    """Compute the median excess return across a set of trade returns."""
    raise NotImplementedError


def compute_win_rate(returns):
    """Compute the fraction of trades with positive excess return."""
    raise NotImplementedError


def aggregate_overall(returns):
    """Compute overall medians and win rates, per holding window and reference date."""
    raise NotImplementedError


def aggregate_by_body(returns):
    """Compute medians and win rates split by disclosure body."""
    raise NotImplementedError


def aggregate_by_filer(returns, min_trades=MIN_TRADES_PER_FILER):
    """Compute medians and win rates split by filer, excluding filers with
    fewer than min_trades qualifying trades."""
    raise NotImplementedError


def main():
    """Load computed returns and produce all aggregation views."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

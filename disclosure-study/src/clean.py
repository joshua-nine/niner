"""Clean normalized filing rows: dedupe, drop non-purchase trades, flag bad tickers.

This study only concerns official stock PURCHASES, so sells (and any other
non-purchase transaction types) are dropped here.
"""


def dedupe_trades(rows):
    """Remove duplicate trade rows (e.g. re-filed or amended disclosures)."""
    raise NotImplementedError


def drop_non_purchases(rows):
    """Keep only rows whose transaction_type represents a purchase."""
    raise NotImplementedError


def flag_missing_or_delisted_tickers(rows):
    """Identify rows whose ticker has no usable price history (missing or delisted).

    Returns the rows annotated with a flag rather than silently dropping them,
    so downstream steps can decide how to handle them.
    """
    raise NotImplementedError


def clean_trades(rows):
    """Run the full cleaning pipeline: dedupe, drop non-purchases, flag bad tickers."""
    raise NotImplementedError


def main():
    """Load normalized filings, clean them, and save the cleaned trade set."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

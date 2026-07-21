"""Pull public stock-transaction disclosures and normalize them to one row per trade.

Each output row must carry the fields defined in the study data model:
filer_name, body, ticker, transaction_date, disclosure_date, transaction_type,
amount_range_low, amount_range_high, source_url.

Note: disclosed amounts are RANGES, not exact values, so position sizing and
dollar P&L cannot be computed from this data — only direction and timing.
"""

from config.settings import START_DATE, END_DATE, BODY


def fetch_raw_filings(start_date=START_DATE, end_date=END_DATE, body=BODY):
    """Download raw filing documents/records for the given date range and body.

    Returns the raw, unnormalized filings as fetched from the source, and
    caches them under data/raw/.
    """
    raise NotImplementedError


def parse_filing(raw_filing):
    """Parse a single raw filing into zero or more normalized trade rows.

    Each returned row must contain: filer_name, body, ticker, transaction_date,
    disclosure_date, transaction_type, amount_range_low, amount_range_high,
    source_url.
    """
    raise NotImplementedError


def normalize_filings(raw_filings):
    """Convert a collection of raw filings into a flat list of trade rows."""
    raise NotImplementedError


def save_normalized_filings(rows, destination):
    """Persist normalized trade rows to disk."""
    raise NotImplementedError


def main():
    """Fetch, normalize, and save filings for the configured study window."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

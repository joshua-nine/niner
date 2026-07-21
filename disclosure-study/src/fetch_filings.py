"""Pull public stock-transaction disclosures and normalize them to one row per trade.

Each output row carries the fields defined in the study data model:
filer_name, body, ticker, transaction_date, disclosure_date, transaction_type,
amount_range_low, amount_range_high, source_url.

Note: disclosed amounts are RANGES, not exact values, so position sizing and
dollar P&L cannot be computed from this data — only direction and timing.
"""

import csv
import json
import logging
import re
import time
from datetime import date, datetime
from pathlib import Path

import requests

from config.settings import (
    BODY,
    DISCLOSURE_SOURCES,
    END_DATE,
    REQUEST_DELAY_SECONDS,
    START_DATE,
)

logger = logging.getLogger(__name__)

RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
NORMALIZED_TRADES_PATH = RAW_DATA_DIR / "normalized_trades.csv"

# Hand-checkable sample used to run the whole pipeline before the real fetcher
# exists. Same columns as the normalized data model (see FIELDNAMES).
SAMPLE_FILINGS_PATH = Path(__file__).resolve().parent.parent / "data" / "sample" / "filings_sample.csv"

FIELDNAMES = [
    "filer_name",
    "body",
    "ticker",
    "transaction_date",
    "disclosure_date",
    "transaction_type",
    "amount_range_low",
    "amount_range_high",
    "source_url",
]

# Canonical transaction_type values accepted in a sample file. These match the
# normalized values produced by _normalize_transaction_type; cleaning keeps
# only "purchase".
KNOWN_TRANSACTION_TYPES = {"purchase", "sale", "exchange"}

# Raw "type" values from the source filings, normalized to these canonical values.
_TRANSACTION_TYPE_MAP = {
    "purchase": "purchase",
    "sale_full": "sale",
    "sale_partial": "sale",
    "sale": "sale",
    "exchange": "exchange",
}

_DATE_FORMATS = ("%m/%d/%Y", "%Y-%m-%d")

_AMOUNT_RANGE_RE = re.compile(r"([\d,]+)\s*-\s*\$?([\d,]+)")
_AMOUNT_OVER_RE = re.compile(r"(?:over|more than)?\s*\$?([\d,]+)\s*\+", re.IGNORECASE)
_AMOUNT_SINGLE_RE = re.compile(r"\$?([\d,]+)")

# Tracks when the last HTTP request went out, so fetch_raw_filings can space
# requests apart even across repeated calls within a process.
_last_request_time = 0.0


def _rate_limited_get(session, url, delay_seconds=REQUEST_DELAY_SECONDS, timeout=30):
    """GET a URL, sleeping first if needed to keep requests at least
    delay_seconds apart. Keeps polling of a disclosure source polite."""
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    wait = delay_seconds - elapsed
    if wait > 0:
        time.sleep(wait)
    try:
        return session.get(url, timeout=timeout)
    finally:
        _last_request_time = time.monotonic()


def _raw_cache_path(body):
    return RAW_DATA_DIR / f"{body}_raw.json"


def fetch_raw_filings(body=BODY, start_date=START_DATE, end_date=END_DATE, session=None):
    """Download raw filing records for `body`, caching the response to
    data/raw/ so reruns don't refetch. Returns the raw parsed JSON.

    start_date/end_date are accepted for interface symmetry with the rest of
    the pipeline; the disclosure sources return their full history in one
    response, so date filtering happens in normalize_filings.
    """
    if body not in DISCLOSURE_SOURCES:
        raise ValueError(f"Unknown disclosure body: {body!r}")

    cache_path = _raw_cache_path(body)
    if cache_path.exists():
        logger.info("Using cached raw filings for body=%s at %s", body, cache_path)
        with open(cache_path) as f:
            return json.load(f)

    session = session or requests.Session()
    url = DISCLOSURE_SOURCES[body]
    logger.info("Fetching raw filings for body=%s from %s", body, url)
    response = _rate_limited_get(session, url)
    response.raise_for_status()
    raw_filings = response.json()

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(raw_filings, f)
    logger.info("Cached %d raw filings to %s", len(raw_filings), cache_path)

    return raw_filings


def _parse_date(value):
    """Parse a date string in any of the source's known formats. Returns None
    if value is missing or doesn't match a known format."""
    if not value:
        return None
    value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount_range(amount):
    """Parse a disclosed amount range string (e.g. "$1,001 - $15,000") into
    (low, high) floats. Open-ended ranges (e.g. "$50,000,000 +") return
    (low, None). Returns (None, None) if unparseable."""
    if not amount:
        return None, None
    amount = amount.strip()

    match = _AMOUNT_RANGE_RE.search(amount)
    if match:
        low = float(match.group(1).replace(",", ""))
        high = float(match.group(2).replace(",", ""))
        return low, high

    match = _AMOUNT_OVER_RE.search(amount)
    if match:
        return float(match.group(1).replace(",", "")), None

    match = _AMOUNT_SINGLE_RE.search(amount)
    if match:
        value = float(match.group(1).replace(",", ""))
        return value, value

    return None, None


def _normalize_transaction_type(raw_type):
    """Map a source-specific transaction type string to one of
    "purchase", "sale", "exchange", or "unknown"."""
    if not raw_type:
        return "unknown"
    key = raw_type.strip().lower().replace(" ", "_").replace("(", "").replace(")", "")
    return _TRANSACTION_TYPE_MAP.get(key, "unknown")


def parse_filing(raw_filing, body=BODY):
    """Parse a single raw filing record into one normalized trade row.

    Returns None if the record is missing a parseable transaction_date or
    disclosure_date, since those are required for every downstream step.
    Missing/unparseable tickers are NOT filtered here — that's clean.py's job.
    """
    transaction_date = _parse_date(raw_filing.get("transaction_date"))
    disclosure_date = _parse_date(raw_filing.get("disclosure_date"))
    if transaction_date is None or disclosure_date is None:
        return None

    filer_name = raw_filing.get("representative") or raw_filing.get("senator") or raw_filing.get("owner")
    ticker = (raw_filing.get("ticker") or "").strip().upper()
    amount_low, amount_high = _parse_amount_range(raw_filing.get("amount"))

    return {
        "filer_name": filer_name,
        "body": body,
        "ticker": ticker,
        "transaction_date": transaction_date,
        "disclosure_date": disclosure_date,
        "transaction_type": _normalize_transaction_type(raw_filing.get("type")),
        "amount_range_low": amount_low,
        "amount_range_high": amount_high,
        "source_url": raw_filing.get("ptr_link"),
    }


def normalize_filings(raw_filings, body=BODY, start_date=START_DATE, end_date=END_DATE):
    """Parse raw filings into trade rows, keeping only those whose
    transaction_date falls within [start_date, end_date]."""
    start = _parse_date(start_date) if isinstance(start_date, str) else start_date
    end = _parse_date(end_date) if isinstance(end_date, str) else end_date

    rows = []
    for raw_filing in raw_filings:
        row = parse_filing(raw_filing, body=body)
        if row is None:
            continue
        if start and row["transaction_date"] < start:
            continue
        if end and row["transaction_date"] > end:
            continue
        rows.append(row)
    return rows


def save_normalized_filings(rows, destination=NORMALIZED_TRADES_PATH):
    """Write normalized trade rows to a CSV file at `destination`."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with open(destination, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for row in rows:
            serialized = dict(row)
            for date_field in ("transaction_date", "disclosure_date"):
                value = serialized.get(date_field)
                if isinstance(value, date):
                    serialized[date_field] = value.isoformat()
            writer.writerow(serialized)
    return destination


class SampleValidationError(ValueError):
    """Raised when a sample filings CSV row fails validation. The message
    always names the offending file line so it can be hand-corrected."""


def _parse_iso_date(value, line_num, field):
    """Parse a strict ISO (YYYY-MM-DD) date, or raise SampleValidationError.

    date.fromisoformat also accepts other separators on some Python versions,
    so the exact 10-char YYYY-MM-DD shape is enforced explicitly -- the sample
    is a template and should model the canonical format, not be coerced.
    """
    value = (value or "").strip()
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        raise SampleValidationError(
            f"line {line_num}: {field} '{value}' is not ISO format YYYY-MM-DD"
        )
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise SampleValidationError(
            f"line {line_num}: {field} '{value}' is not a valid date"
        )


def _parse_amount(value, line_num, field):
    """Parse a required numeric amount, or raise SampleValidationError."""
    value = (value or "").strip()
    if value == "":
        raise SampleValidationError(f"line {line_num}: {field} is empty")
    try:
        return float(value)
    except ValueError:
        raise SampleValidationError(
            f"line {line_num}: {field} '{value}' is not a number"
        )


def load_sample_filings(path=SAMPLE_FILINGS_PATH):
    """Load and validate a hand-authored sample filings CSV, returning
    normalized trade rows (dates as date objects, amounts as floats) in the
    same shape as normalize_filings().

    Validation is strict and fails loudly with the offending file line number,
    never silently coercing:
      - every data-model column must be present in the header
      - transaction_date and disclosure_date must be parseable ISO (YYYY-MM-DD)
      - transaction_type must be in KNOWN_TRANSACTION_TYPES
      - amount_range_low <= amount_range_high, both numeric
    """
    path = Path(path)
    if not path.exists():
        raise SampleValidationError(f"sample file not found: {path}")

    with open(path, newline="") as f:
        reader = csv.DictReader(f)

        header = reader.fieldnames or []
        missing = [c for c in FIELDNAMES if c not in header]
        if missing:
            raise SampleValidationError(
                f"line 1: missing required column(s): {', '.join(missing)}"
            )

        rows = []
        for raw in reader:
            line_num = reader.line_num  # 1-based file line, header is line 1

            transaction_date = _parse_iso_date(
                raw.get("transaction_date"), line_num, "transaction_date"
            )
            disclosure_date = _parse_iso_date(
                raw.get("disclosure_date"), line_num, "disclosure_date"
            )

            transaction_type = (raw.get("transaction_type") or "").strip()
            if transaction_type not in KNOWN_TRANSACTION_TYPES:
                raise SampleValidationError(
                    f"line {line_num}: transaction_type '{transaction_type}' not in "
                    f"{sorted(KNOWN_TRANSACTION_TYPES)}"
                )

            amount_low = _parse_amount(raw.get("amount_range_low"), line_num, "amount_range_low")
            amount_high = _parse_amount(raw.get("amount_range_high"), line_num, "amount_range_high")
            if amount_low > amount_high:
                raise SampleValidationError(
                    f"line {line_num}: amount_range_low ({amount_low}) > "
                    f"amount_range_high ({amount_high})"
                )

            rows.append(
                {
                    "filer_name": (raw.get("filer_name") or "").strip(),
                    "body": (raw.get("body") or "").strip(),
                    "ticker": (raw.get("ticker") or "").strip().upper(),
                    "transaction_date": transaction_date,
                    "disclosure_date": disclosure_date,
                    "transaction_type": transaction_type,
                    "amount_range_low": amount_low,
                    "amount_range_high": amount_high,
                    "source_url": (raw.get("source_url") or "").strip(),
                }
            )

    logger.info("Loaded %d validated sample filing rows from %s", len(rows), path)
    return rows


def main():
    """Fetch, normalize, and save filings for the configured study window."""
    logging.basicConfig(level=logging.INFO)
    raw_filings = fetch_raw_filings()
    rows = normalize_filings(raw_filings)
    destination = save_normalized_filings(rows)
    logger.info("Wrote %d normalized trade rows to %s", len(rows), destination)


if __name__ == "__main__":
    main()

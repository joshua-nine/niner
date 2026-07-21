"""Tests for src/fetch_filings.py."""

from datetime import date

import pytest

from src.fetch_filings import (
    SAMPLE_FILINGS_PATH,
    SampleValidationError,
    load_sample_filings,
)

HEADER = (
    "filer_name,body,ticker,transaction_date,disclosure_date,"
    "transaction_type,amount_range_low,amount_range_high,source_url"
)

GOOD_ROW = "Jane Doe,house,AAPL,2021-01-04,2021-01-20,purchase,1001,15000,https://x/1"


def write_csv(tmp_path, *rows, header=HEADER):
    path = tmp_path / "filings_sample.csv"
    path.write_text("\n".join([header, *rows]) + "\n")
    return path


def test_committed_sample_file_loads_and_validates():
    """The sample shipped in the repo must itself pass validation."""
    rows = load_sample_filings(SAMPLE_FILINGS_PATH)

    assert len(rows) == 3
    assert rows[0]["ticker"] == "AAPL"
    assert rows[0]["transaction_date"] == date(2021, 1, 4)
    assert rows[0]["amount_range_low"] == 1001.0
    # Exactly one of the three example rows is a sell (dropped later by cleaning).
    assert sum(1 for r in rows if r["transaction_type"] == "sale") == 1


def test_load_sample_returns_normalized_types(tmp_path):
    path = write_csv(tmp_path, GOOD_ROW)

    rows = load_sample_filings(path)

    row = rows[0]
    assert isinstance(row["transaction_date"], date)
    assert isinstance(row["disclosure_date"], date)
    assert isinstance(row["amount_range_low"], float)
    assert isinstance(row["amount_range_high"], float)


def test_missing_column_fails_loudly(tmp_path):
    bad_header = HEADER.replace(",source_url", "")
    path = write_csv(tmp_path, GOOD_ROW.rsplit(",", 1)[0], header=bad_header)

    with pytest.raises(SampleValidationError, match="missing required column"):
        load_sample_filings(path)


def test_non_iso_date_fails_with_line_number(tmp_path):
    bad = "Jane Doe,house,AAPL,01/04/2021,2021-01-20,purchase,1001,15000,https://x/1"
    path = write_csv(tmp_path, GOOD_ROW, bad)

    with pytest.raises(SampleValidationError, match="line 3: transaction_date"):
        load_sample_filings(path)


def test_unparseable_date_fails(tmp_path):
    bad = "Jane Doe,house,AAPL,2021-13-40,2021-01-20,purchase,1001,15000,https://x/1"
    path = write_csv(tmp_path, bad)

    with pytest.raises(SampleValidationError, match="line 2: transaction_date"):
        load_sample_filings(path)


def test_unknown_transaction_type_fails_with_line_number(tmp_path):
    bad = "Jane Doe,house,AAPL,2021-01-04,2021-01-20,gift,1001,15000,https://x/1"
    path = write_csv(tmp_path, bad)

    with pytest.raises(SampleValidationError, match="line 2: transaction_type 'gift'"):
        load_sample_filings(path)


def test_amount_low_greater_than_high_fails(tmp_path):
    bad = "Jane Doe,house,AAPL,2021-01-04,2021-01-20,purchase,50000,15000,https://x/1"
    path = write_csv(tmp_path, bad)

    with pytest.raises(SampleValidationError, match="line 2: amount_range_low"):
        load_sample_filings(path)


def test_non_numeric_amount_fails(tmp_path):
    bad = "Jane Doe,house,AAPL,2021-01-04,2021-01-20,purchase,lots,15000,https://x/1"
    path = write_csv(tmp_path, bad)

    with pytest.raises(SampleValidationError, match="line 2: amount_range_low"):
        load_sample_filings(path)


def test_empty_amount_fails(tmp_path):
    bad = "Jane Doe,house,AAPL,2021-01-04,2021-01-20,purchase,1001,,https://x/1"
    path = write_csv(tmp_path, bad)

    with pytest.raises(SampleValidationError, match="line 2: amount_range_high is empty"):
        load_sample_filings(path)


def test_line_number_points_to_second_bad_row(tmp_path):
    """The reported line number must match the file line, so the offending
    row can be found by hand."""
    bad = "Bad One,house,MSFT,2021-02-01,not-a-date,purchase,1001,15000,https://x/2"
    path = write_csv(tmp_path, GOOD_ROW, GOOD_ROW, bad)

    with pytest.raises(SampleValidationError, match="line 4: disclosure_date"):
        load_sample_filings(path)


def test_missing_file_fails_loudly(tmp_path):
    with pytest.raises(SampleValidationError, match="sample file not found"):
        load_sample_filings(tmp_path / "does_not_exist.csv")

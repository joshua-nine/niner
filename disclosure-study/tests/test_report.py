"""Tests for src/report.py."""

import csv

from src.report import (
    _fmt_pct,
    _fmt_rate,
    write_results_csv,
    write_summary_markdown,
)


def make_aggregates():
    overall = {
        (30, "transaction_date"): {
            "trade_count": 4,
            "missing_count": 1,
            "median_excess_return": 0.025,
            "win_rate": 0.5,
        },
        (30, "disclosure_date"): {
            "trade_count": 4,
            "missing_count": 0,
            "median_excess_return": -0.01,
            "win_rate": 0.25,
        },
    }
    return {
        "overall": overall,
        "by_body": {"house": overall},
        "by_filer": {"Jane Doe": overall},
    }


def make_study_summary():
    return {
        "start_date": "2020-01-01",
        "end_date": "2025-12-31",
        "body": "house",
        "windows": [30, 90, 180],
        "min_trades_per_filer": 10,
        "filings_pulled": 1000,
        "clean_summary": {
            "rows_in": 800,
            "dropped_non_purchase": 300,
            "dropped_duplicate": 50,
            "dropped_bad_ticker": 20,
            "dropped_bad_date_order": 5,
            "flagged_no_price_history": 15,
            "rows_out": 425,
        },
        "tickers_no_price": 7,
        "spy_total_return": 0.9123,
        "spy_start_date": "2020-01-02",
        "spy_end_date": "2025-12-30",
    }


def test_fmt_pct_signs_and_null():
    assert _fmt_pct(0.025) == "+2.50%"
    assert _fmt_pct(-0.01) == "-1.00%"
    assert _fmt_pct(None) == "n/a"


def test_fmt_rate_and_null():
    assert _fmt_rate(0.5) == "50.0%"
    assert _fmt_rate(None) == "n/a"


def test_write_results_csv_flattens_all_scopes(tmp_path):
    dest = tmp_path / "results.csv"

    write_results_csv(make_aggregates(), dest)

    with open(dest, newline="") as f:
        rows = list(csv.DictReader(f))

    scopes = {row["scope"] for row in rows}
    assert scopes == {"overall", "body", "filer"}
    # 2 (window,anchor) cells x 3 scopes = 6 rows.
    assert len(rows) == 6

    overall_rows = [r for r in rows if r["scope"] == "overall"]
    assert len(overall_rows) == 2
    body_row = next(r for r in rows if r["scope"] == "body")
    assert body_row["group"] == "house"


def test_write_summary_markdown_states_provenance_up_front(tmp_path):
    dest = tmp_path / "results.md"

    write_summary_markdown(make_study_summary(), make_aggregates(), dest)
    text = dest.read_text()

    # Provenance / cleaning funnel must appear before the aggregate tables.
    header_idx = text.index("Data provenance and cleaning")
    overall_idx = text.index("## Overall")
    assert header_idx < overall_idx

    # Required up-front facts.
    assert "2020-01-01 to 2025-12-31" in text
    assert "house" in text
    assert "1,000" in text  # filings pulled
    assert "425" in text  # trades after cleaning
    assert "300" in text  # non-purchase removed
    assert "7" in text  # tickers with no price data
    assert "+91.23%" in text  # SPY total return


def test_write_summary_markdown_has_tables_and_interpretation(tmp_path):
    dest = tmp_path / "results.md"

    write_summary_markdown(make_study_summary(), make_aggregates(), dest)
    text = dest.read_text()

    assert "## By disclosure body" in text
    assert "## By filer" in text
    assert "What these numbers do and do not support" in text
    # Ranges caveat must be stated in the interpretation.
    assert "ranges" in text.lower()
    # Rendered percentages from the aggregate table.
    assert "+2.50%" in text


def test_write_summary_markdown_handles_empty_filer_split(tmp_path):
    dest = tmp_path / "results.md"
    aggregates = make_aggregates()
    aggregates["by_filer"] = {}

    write_summary_markdown(make_study_summary(), aggregates, dest)
    text = dest.read_text()

    assert "No filer met the minimum" in text


def test_missing_provenance_shows_message_not_zero_table(tmp_path):
    """When provenance is unavailable (standalone render), the cleaning
    section must state so plainly and must NOT print a table of zeros, which
    would read as a real 'nothing was removed' finding."""
    dest = tmp_path / "results.md"

    summary = make_study_summary()
    summary["clean_summary"] = None
    summary["filings_pulled"] = None
    summary["tickers_no_price"] = None

    write_summary_markdown(summary, make_aggregates(), dest)
    text = dest.read_text()

    # The unavailable message is present, ahead of the aggregate tables.
    assert "Provenance unavailable" in text
    assert text.index("Provenance unavailable") < text.index("## Overall")

    # No cleaning-funnel table (of zeros or otherwise) appears.
    assert "Rows removed by each cleaning rule" not in text
    # None of the funnel lines appear at all in the fully-unavailable case.
    assert " | 0 |" not in text
    assert "**Trades after cleaning:**" not in text
    assert "**Filings pulled from source:**" not in text
    assert "**Distinct tickers with no price data" not in text

    # The report still renders the real aggregate tables around it.
    assert "## Overall" in text
    assert "+2.50%" in text


def test_partial_provenance_shows_unavailable_for_missing_counts(tmp_path):
    """If the cleaning funnel exists but filings_pulled / tickers_no_price are
    missing, those two fields must render as 'unavailable', not as a number."""
    dest = tmp_path / "results.md"

    summary = make_study_summary()
    summary["filings_pulled"] = None
    summary["tickers_no_price"] = None

    write_summary_markdown(summary, make_aggregates(), dest)
    text = dest.read_text()

    assert "**Filings pulled from source:** unavailable" in text
    assert "no price data (delisted / acquired / unmatched):** unavailable" in text
    # The real cleaning funnel (from clean_summary) still prints.
    assert "Rows removed by each cleaning rule" in text
    assert "425" in text  # rows_out is a real value, still shown


def test_fmt_count_uses_unavailable_for_none():
    from src.report import _fmt_count

    assert _fmt_count(None) == "unavailable"
    assert _fmt_count(0) == "0"
    assert _fmt_count(1000) == "1,000"

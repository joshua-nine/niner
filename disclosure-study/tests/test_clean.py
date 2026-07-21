"""Tests for src/clean.py."""

from datetime import date

from src.clean import (
    clean_trades,
    dedupe_trades,
    drop_bad_date_order,
    drop_bad_tickers,
    drop_non_purchases,
    flag_missing_or_delisted_tickers,
    has_price_history,
)


def make_row(**overrides):
    row = {
        "filer_name": "Jane Doe",
        "body": "house",
        "ticker": "AAPL",
        "transaction_date": date(2021, 1, 5),
        "disclosure_date": date(2021, 2, 1),
        "transaction_type": "purchase",
        "amount_range_low": 1001.0,
        "amount_range_high": 15000.0,
        "source_url": "https://example.com/filing",
    }
    row.update(overrides)
    return row


def test_drop_non_purchases_keeps_only_purchases():
    rows = [
        make_row(transaction_type="purchase"),
        make_row(transaction_type="sale"),
        make_row(transaction_type="exchange"),
        make_row(transaction_type="purchase"),
    ]

    kept, removed = drop_non_purchases(rows)

    assert removed == 2
    assert len(kept) == 2
    assert all(row["transaction_type"] == "purchase" for row in kept)


def test_dedupe_collapses_same_filer_ticker_date():
    rows = [
        make_row(filer_name="Jane Doe", ticker="AAPL", transaction_date=date(2021, 1, 5)),
        make_row(filer_name="Jane Doe", ticker="AAPL", transaction_date=date(2021, 1, 5)),  # spouse account
        make_row(filer_name="Jane Doe", ticker="MSFT", transaction_date=date(2021, 1, 5)),
        make_row(filer_name="John Roe", ticker="AAPL", transaction_date=date(2021, 1, 5)),
    ]

    kept, removed = dedupe_trades(rows)

    assert removed == 1
    assert len(kept) == 3
    keys = {(row["filer_name"], row["ticker"], row["transaction_date"]) for row in kept}
    assert len(keys) == 3


def test_drop_bad_tickers_removes_missing_and_unparseable():
    rows = [
        make_row(ticker="AAPL"),
        make_row(ticker=""),
        make_row(ticker=None),
        make_row(ticker="--"),
        make_row(ticker="N/A"),
        make_row(ticker="BRK.B"),
    ]

    kept, removed = drop_bad_tickers(rows)

    assert removed == 4
    assert {row["ticker"] for row in kept} == {"AAPL", "BRK.B"}


def test_flag_missing_or_delisted_tickers_does_not_drop(tmp_path):
    (tmp_path / "AAPL.csv").write_text("date,close\n2021-01-05,130.0\n")

    rows = [make_row(ticker="AAPL"), make_row(ticker="DELISTEDCO")]

    kept, flagged = flag_missing_or_delisted_tickers(rows, price_dir=tmp_path)

    assert flagged == 1
    assert len(kept) == 2  # nothing dropped
    by_ticker = {row["ticker"]: row["no_price_history"] for row in kept}
    assert by_ticker["AAPL"] is False
    assert by_ticker["DELISTEDCO"] is True


def test_has_price_history(tmp_path):
    (tmp_path / "AAPL.csv").write_text("date,close\n2021-01-05,130.0\n")

    assert has_price_history("AAPL", price_dir=tmp_path) is True
    assert has_price_history("MISSING", price_dir=tmp_path) is False
    assert has_price_history("", price_dir=tmp_path) is False
    assert has_price_history(None, price_dir=tmp_path) is False


def test_drop_bad_date_order_removes_disclosure_before_transaction():
    rows = [
        make_row(transaction_date=date(2021, 1, 5), disclosure_date=date(2021, 2, 1)),  # ok
        make_row(transaction_date=date(2021, 1, 5), disclosure_date=date(2021, 1, 5)),  # ok, same day
        make_row(transaction_date=date(2021, 3, 1), disclosure_date=date(2021, 2, 1)),  # bad: disclosed before trade
    ]

    kept, removed = drop_bad_date_order(rows)

    assert removed == 1
    assert len(kept) == 2


def test_clean_trades_full_pipeline_counts(tmp_path):
    (tmp_path / "AAPL.csv").write_text("date,close\n2021-01-05,130.0\n")
    (tmp_path / "MSFT.csv").write_text("date,close\n2021-01-05,220.0\n")

    rows = [
        make_row(filer_name="Jane Doe", ticker="AAPL", transaction_type="purchase"),  # kept
        make_row(filer_name="Jane Doe", ticker="AAPL", transaction_type="purchase"),  # duplicate of above
        make_row(filer_name="Jane Doe", ticker="MSFT", transaction_type="sale"),  # dropped: not a purchase
        make_row(filer_name="John Roe", ticker="", transaction_type="purchase"),  # dropped: bad ticker
        make_row(
            filer_name="John Roe",
            ticker="ZZZZ",
            transaction_type="purchase",
            transaction_date=date(2021, 5, 1),
            disclosure_date=date(2021, 6, 1),
        ),  # kept but flagged: no price history
        make_row(
            filer_name="Ann Lee",
            ticker="MSFT",
            transaction_type="purchase",
            transaction_date=date(2021, 6, 1),
            disclosure_date=date(2021, 5, 1),
        ),  # dropped: disclosed before transaction
    ]

    cleaned, summary = clean_trades(rows, price_dir=tmp_path)

    assert summary["rows_in"] == 6
    assert summary["dropped_non_purchase"] == 1
    assert summary["dropped_duplicate"] == 1
    assert summary["dropped_bad_ticker"] == 1
    assert summary["flagged_no_price_history"] == 1
    assert summary["dropped_bad_date_order"] == 1
    assert summary["rows_out"] == 2
    assert len(cleaned) == 2

"""Tests for src/fetch_prices.py."""

from datetime import date

import pytest

from src.fetch_prices import (
    _yahoo_symbol,
    cache_prices,
    download_prices,
    get_cached_prices,
    get_prices,
)


class FakeResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeSession:
    def __init__(self, response=None, responses=None):
        # Either a single response (returned every call) or a queue of
        # responses returned in order (for retry tests).
        self._response = response
        self._responses = list(responses) if responses else None
        self.calls = []

    def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append((url, params))
        if self._responses is not None:
            return self._responses.pop(0)
        return self._response


def chart_payload(timestamps, closes):
    return {
        "chart": {
            "result": [
                {
                    "timestamp": timestamps,
                    "indicators": {"quote": [{"close": closes}]},
                }
            ]
        }
    }


def test_yahoo_symbol_converts_share_class_dot_to_hyphen():
    assert _yahoo_symbol("BRK.B") == "BRK-B"
    assert _yahoo_symbol("AAPL") == "AAPL"


def test_get_cached_prices_returns_none_when_not_cached(tmp_path, monkeypatch):
    monkeypatch.setattr("src.fetch_prices.PRICES_DIR", tmp_path)

    assert get_cached_prices("AAPL") is None


def test_cache_prices_round_trips_through_get_cached_prices(tmp_path, monkeypatch):
    monkeypatch.setattr("src.fetch_prices.PRICES_DIR", tmp_path)

    prices = {date(2021, 1, 4): 130.0, date(2021, 1, 5): 131.5}
    cache_prices("AAPL", prices)

    assert get_cached_prices("AAPL") == prices


def test_download_prices_parses_chart_payload():
    # 2021-01-04 09:30 ET and 2021-01-05 09:30 ET, as epoch seconds.
    payload = chart_payload([1609770600, 1609857000], [130.0, 131.5])
    session = FakeSession(FakeResponse(200, payload))

    prices = download_prices("AAPL", date(2021, 1, 4), date(2021, 1, 5), session=session)

    assert prices == {date(2021, 1, 4): 130.0, date(2021, 1, 5): 131.5}


def test_download_prices_skips_null_closes():
    payload = chart_payload([1609770600, 1609857000], [130.0, None])
    session = FakeSession(FakeResponse(200, payload))

    prices = download_prices("AAPL", date(2021, 1, 4), date(2021, 1, 5), session=session)

    assert prices == {date(2021, 1, 4): 130.0}


def test_download_prices_returns_empty_on_404():
    session = FakeSession(FakeResponse(404, {"chart": {"result": None}}))

    prices = download_prices("NOTATICKER", date(2021, 1, 4), date(2021, 1, 5), session=session)

    assert prices == {}


def test_download_prices_retries_transient_400_then_succeeds(monkeypatch):
    monkeypatch.setattr("src.fetch_prices.time.sleep", lambda _s: None)
    payload = chart_payload([1609770600], [130.0])
    session = FakeSession(
        responses=[FakeResponse(400), FakeResponse(200, payload)]
    )

    prices = download_prices("GOOG", date(2021, 1, 4), date(2021, 1, 4), session=session)

    assert prices == {date(2021, 1, 4): 130.0}
    assert len(session.calls) == 2  # one retry


def test_download_prices_does_not_retry_404(monkeypatch):
    monkeypatch.setattr("src.fetch_prices.time.sleep", lambda _s: None)
    session = FakeSession(
        responses=[FakeResponse(404, {"chart": {"result": None}}), FakeResponse(200)]
    )

    prices = download_prices("NOTATICKER", date(2021, 1, 4), date(2021, 1, 4), session=session)

    assert prices == {}
    assert len(session.calls) == 1  # 404 is definitive, no retry


def test_download_prices_raises_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr("src.fetch_prices.time.sleep", lambda _s: None)
    session = FakeSession(response=FakeResponse(429))

    with pytest.raises(RuntimeError):
        download_prices("AAPL", date(2021, 1, 4), date(2021, 1, 4), session=session)

    assert len(session.calls) == 3  # MAX_RETRIES attempts


def test_get_prices_uses_cache_without_hitting_network(tmp_path, monkeypatch):
    monkeypatch.setattr("src.fetch_prices.PRICES_DIR", tmp_path)
    cache_prices("AAPL", {date(2021, 1, 4): 130.0})

    session = FakeSession(FakeResponse(500))  # would raise if actually called

    prices = get_prices("AAPL", date(2021, 1, 4), date(2021, 1, 5), session=session)

    assert prices == {date(2021, 1, 4): 130.0}
    assert session.calls == []


def test_get_prices_downloads_and_caches_on_miss(tmp_path, monkeypatch):
    monkeypatch.setattr("src.fetch_prices.PRICES_DIR", tmp_path)
    payload = chart_payload([1609770600], [130.0])
    session = FakeSession(FakeResponse(200, payload))

    prices = get_prices("AAPL", date(2021, 1, 4), date(2021, 1, 4), session=session)

    assert prices == {date(2021, 1, 4): 130.0}
    assert get_cached_prices("AAPL") == {date(2021, 1, 4): 130.0}


def test_get_prices_does_not_cache_empty_result(tmp_path, monkeypatch):
    monkeypatch.setattr("src.fetch_prices.PRICES_DIR", tmp_path)
    session = FakeSession(FakeResponse(404, {"chart": {"result": None}}))

    prices = get_prices("DELISTEDCO", date(2021, 1, 4), date(2021, 1, 4), session=session)

    assert prices == {}
    assert get_cached_prices("DELISTEDCO") is None

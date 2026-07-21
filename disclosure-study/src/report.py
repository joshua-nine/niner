"""Write final study results to CSV and a human-readable summary markdown file.

results.csv holds the flat aggregate tables (one row per scope/group/window/
anchor). results.md leads with the study's provenance and cleaning funnel --
so a reader can judge how much the headline numbers can bear -- then the
aggregate tables, and closes with a plain-language reading of what the
numbers do and do not support.
"""

import csv
import logging
from pathlib import Path

from config.settings import BENCHMARK

logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).resolve().parent.parent / "data"
RESULTS_CSV_PATH = RESULTS_DIR / "results.csv"
RESULTS_MD_PATH = RESULTS_DIR / "results.md"

ANCHOR_LABELS = {
    "transaction_date": "From transaction date",
    "disclosure_date": "From disclosure date",
}

CSV_FIELDNAMES = [
    "scope",
    "group",
    "window_days",
    "anchor",
    "trade_count",
    "missing_count",
    "median_excess_return",
    "win_rate",
]


def _fmt_pct(value):
    """Format a fractional return as a signed percentage, or 'n/a' if null."""
    if value is None:
        return "n/a"
    return f"{value * 100:+.2f}%"


def _fmt_rate(value):
    """Format a win rate (0-1) as a percentage, or 'n/a' if null."""
    if value is None:
        return "n/a"
    return f"{value * 100:.1f}%"


def _sorted_windows(aggregate):
    """Return the distinct window_days present in an aggregate view, sorted."""
    return sorted({window for (window, _anchor) in aggregate})


def _sorted_anchors(aggregate):
    """Return the distinct anchors present, transaction_date first."""
    order = {"transaction_date": 0, "disclosure_date": 1}
    anchors = {anchor for (_window, anchor) in aggregate}
    return sorted(anchors, key=lambda a: order.get(a, 99))


def _aggregate_to_csv_rows(scope, group, aggregate):
    """Flatten one aggregate view (keyed by (window, anchor)) into CSV row dicts."""
    rows = []
    for (window_days, anchor), stats in sorted(aggregate.items()):
        rows.append(
            {
                "scope": scope,
                "group": group,
                "window_days": window_days,
                "anchor": anchor,
                "trade_count": stats["trade_count"],
                "missing_count": stats["missing_count"],
                "median_excess_return": stats["median_excess_return"],
                "win_rate": stats["win_rate"],
            }
        )
    return rows


def write_results_csv(aggregates, destination=RESULTS_CSV_PATH):
    """Write the aggregated results (overall, by-body, by-filer) to a CSV file.

    `aggregates` is {"overall": {...}, "by_body": {body: {...}},
    "by_filer": {filer: {...}}}.
    """
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)

    rows = _aggregate_to_csv_rows("overall", "", aggregates["overall"])
    for body, aggregate in sorted(aggregates["by_body"].items()):
        rows.extend(_aggregate_to_csv_rows("body", body, aggregate))
    for filer, aggregate in sorted(aggregates["by_filer"].items()):
        rows.extend(_aggregate_to_csv_rows("filer", filer, aggregate))

    with open(destination, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    return destination


def _render_aggregate_table(aggregate):
    """Render one aggregate view as a markdown table: rows = windows,
    columns grouped by anchor with median / win rate / trade count."""
    windows = _sorted_windows(aggregate)
    anchors = _sorted_anchors(aggregate)

    lines = []
    header = ["Window (days)"]
    for anchor in anchors:
        label = ANCHOR_LABELS.get(anchor, anchor)
        header.extend([f"{label} — median excess", "win rate", "trades (null)"])
    lines.append("| " + " | ".join(header) + " |")
    lines.append("|" + "|".join(["---"] * len(header)) + "|")

    for window in windows:
        cells = [str(window)]
        for anchor in anchors:
            stats = aggregate.get((window, anchor))
            if stats is None:
                cells.extend(["n/a", "n/a", "0 (0)"])
                continue
            cells.append(_fmt_pct(stats["median_excess_return"]))
            cells.append(_fmt_rate(stats["win_rate"]))
            cells.append(f"{stats['trade_count']} ({stats['missing_count']})")
        lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines)


def _render_header(study_summary):
    """Render the leading provenance/cleaning block of the markdown report."""
    s = study_summary
    clean = s["clean_summary"]

    lines = [
        "# Disclosure Study Results",
        "",
        "## Study parameters",
        "",
        f"- **Date range studied (transaction date):** {s['start_date']} to {s['end_date']}",
        f"- **Disclosure body:** {s['body']}",
        f"- **Benchmark:** {BENCHMARK}",
        f"- **Holding windows (days):** {', '.join(str(w) for w in s['windows'])}",
        f"- **Minimum trades per filer (for the by-filer split):** {s['min_trades_per_filer']}",
        "",
        "## Data provenance and cleaning",
        "",
        f"- **Filings pulled from source:** {s['filings_pulled']:,}",
        f"- **Trades entering cleaning (in date range):** {clean['rows_in']:,}",
        "",
        "Rows removed by each cleaning rule:",
        "",
        "| Rule | Rows removed |",
        "|---|---|",
        f"| Not a purchase (sells, exchanges) | {clean['dropped_non_purchase']:,} |",
        f"| Duplicate (same filer + ticker + transaction date) | {clean['dropped_duplicate']:,} |",
        f"| Missing / unparseable ticker | {clean['dropped_bad_ticker']:,} |",
        f"| Disclosure date before transaction date | {clean['dropped_bad_date_order']:,} |",
        "",
        f"- **Trades after cleaning:** {clean['rows_out']:,}",
        f"- **Rows flagged with no price history (kept, not dropped):** "
        f"{clean['flagged_no_price_history']:,}",
        f"- **Distinct tickers with no price data (delisted / acquired / unmatched):** "
        f"{s['tickers_no_price']:,}",
        "",
        "> Tickers with no price history are flagged and **kept**, not dropped. "
        "Dropping them would bias results upward, since companies that were "
        "acquired or delisted are disproportionately excluded otherwise. Their "
        "trades still appear in the counts but contribute null returns.",
        "",
        "## Market context",
        "",
        f"- **{BENCHMARK} total return over the study period "
        f"({s['spy_start_date']} to {s['spy_end_date']}):** {_fmt_pct(s['spy_total_return'])}",
        "",
        "Excess return below is always measured against the identical calendar "
        "window for each trade, not against this single period figure — this "
        "number is context only.",
        "",
    ]
    return "\n".join(lines)


def _render_interpretation(study_summary, aggregates):
    """Render the closing plain-language paragraph on what the numbers support."""
    overall = aggregates["overall"]
    n_filers = len(aggregates["by_filer"])

    lines = [
        "## What these numbers do and do not support",
        "",
        "This study measures whether publicly disclosed official stock "
        "**purchases** beat the market, using the **median** excess return "
        "versus the benchmark over fixed holding windows — measured both from "
        "the transaction date and from the (later) public disclosure date. A "
        "positive median means more than half of purchases beat the benchmark "
        "by that margin over that window; the win rate says how often they beat "
        "it at all. Comparing the two anchors shows how much of any edge is "
        "already gone by the time the public could have acted on the "
        "disclosure.",
        "",
        "**What the numbers cannot support.** Disclosed amounts are reported as "
        "**ranges, not exact values**, so nothing here is position-sized: these "
        "are per-trade directional returns, never a dollar-weighted portfolio "
        "P&L, and a filer's few large purchases count the same as their many "
        "small ones. The study covers only purchases, so it says nothing about "
        "sell-side timing. Excess return over a benchmark is not risk-adjusted, "
        "and beating the benchmark is not evidence of skill, causation, or "
        "misuse of information — it is consistent with sector tilts, luck, or "
        "broad factor exposure. Trades whose window runs past the available "
        "price data, or whose ticker has no price history, contribute null and "
        "are shown as such rather than being quietly filled or dropped; where "
        "the null count is high relative to the trade count, treat that cell as "
        "indicative at best. Per-filer figures are shown only for filers with "
        f"at least {study_summary['min_trades_per_filer']} trades "
        f"({n_filers} filer(s) qualified), and even those are small samples in "
        "which a single position can move the median. Read every figure as a "
        "description of this dataset over this window, not as a forecast.",
        "",
    ]

    if not any(stats["median_excess_return"] is not None for stats in overall.values()):
        lines.insert(
            2,
            "_No window had enough non-null trades to report a median excess "
            "return; the interpretation below is therefore purely methodological._\n",
        )

    return "\n".join(lines)


def write_summary_markdown(study_summary, aggregates, destination=RESULTS_MD_PATH):
    """Write a human-readable markdown summary of the study's findings."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)

    sections = [_render_header(study_summary)]

    sections.append("## Overall\n")
    sections.append(_render_aggregate_table(aggregates["overall"]))
    sections.append("")

    if aggregates["by_body"]:
        sections.append("## By disclosure body\n")
        for body, aggregate in sorted(aggregates["by_body"].items()):
            sections.append(f"### {body}\n")
            sections.append(_render_aggregate_table(aggregate))
            sections.append("")

    sections.append("## By filer\n")
    if aggregates["by_filer"]:
        sections.append(
            f"Filers with at least {study_summary['min_trades_per_filer']} trades only.\n"
        )
        for filer, aggregate in sorted(aggregates["by_filer"].items()):
            sections.append(f"### {filer}\n")
            sections.append(_render_aggregate_table(aggregate))
            sections.append("")
    else:
        sections.append(
            f"No filer met the minimum of {study_summary['min_trades_per_filer']} "
            "trades, so no per-filer breakdown is shown.\n"
        )

    sections.append(_render_interpretation(study_summary, aggregates))

    with open(destination, "w") as f:
        f.write("\n".join(sections).rstrip() + "\n")
    return destination


def write_reports(study_summary, aggregates, csv_path=RESULTS_CSV_PATH, md_path=RESULTS_MD_PATH):
    """Write both the CSV and markdown report outputs. Returns (csv_path, md_path)."""
    csv_dest = write_results_csv(aggregates, csv_path)
    md_dest = write_summary_markdown(study_summary, aggregates, md_path)
    return csv_dest, md_dest


def main():
    """Load aggregates from disk and write both report outputs.

    Kept thin: the full pipeline (which threads the study_summary through)
    lives in main.py. Running this module directly re-renders the reports
    from the already-computed returns file, using placeholder provenance.
    """
    logging.basicConfig(level=logging.INFO)

    from config.settings import BODY, END_DATE, HOLDING_WINDOWS, MIN_TRADES_PER_FILER, START_DATE
    from src.aggregate import _load_returns, aggregate_by_body, aggregate_by_filer, aggregate_overall

    returns = _load_returns()
    aggregates = {
        "overall": aggregate_overall(returns),
        "by_body": aggregate_by_body(returns),
        "by_filer": aggregate_by_filer(returns),
    }
    study_summary = {
        "start_date": START_DATE,
        "end_date": END_DATE,
        "body": BODY,
        "windows": HOLDING_WINDOWS,
        "min_trades_per_filer": MIN_TRADES_PER_FILER,
        "filings_pulled": len({(r["filer_name"], r["ticker"], r["transaction_date"]) for r in returns}),
        "clean_summary": {
            "rows_in": 0,
            "dropped_non_purchase": 0,
            "dropped_duplicate": 0,
            "dropped_bad_ticker": 0,
            "dropped_bad_date_order": 0,
            "flagged_no_price_history": 0,
            "rows_out": len({(r["filer_name"], r["ticker"], r["transaction_date"]) for r in returns}),
        },
        "tickers_no_price": 0,
        "spy_total_return": None,
        "spy_start_date": "n/a",
        "spy_end_date": "n/a",
    }
    csv_dest, md_dest = write_reports(study_summary, aggregates)
    logger.info("Wrote %s and %s", csv_dest, md_dest)


if __name__ == "__main__":
    main()

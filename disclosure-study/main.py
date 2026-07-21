"""Entry point: run the full disclosure-study pipeline end to end.

Pipeline stages: fetch_filings -> fetch_prices -> clean -> returns -> aggregate -> report.
"""


def run_pipeline():
    """Run all pipeline stages in order and produce the final study outputs."""
    raise NotImplementedError


def main():
    """CLI entry point for running the pipeline."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

"""Write final study results to CSV and a human-readable summary markdown file."""


def write_results_csv(aggregates, destination):
    """Write aggregated results (overall, by-body, by-filer) to a CSV file."""
    raise NotImplementedError


def write_summary_markdown(aggregates, destination):
    """Write a human-readable markdown summary of the study's findings."""
    raise NotImplementedError


def main():
    """Load aggregates and write both the CSV and markdown report outputs."""
    raise NotImplementedError


if __name__ == "__main__":
    main()

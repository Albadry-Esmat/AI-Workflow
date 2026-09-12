import csv
from pathlib import Path

def total(path: str) -> int:
    with Path(path).open(newline="") as handle:
        return sum(int(row["value"]) for row in csv.DictReader(handle))

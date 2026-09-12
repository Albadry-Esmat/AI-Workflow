"""Run deterministic Batch 7 context compression/resume preservation tests."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
CASE_ROOT = ROOT / "evals" / "context-preservation" / "cases"
SCHEMA = ROOT / "config" / "context-preservation-schema.json"


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def payload_hash(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def run_case(case: dict) -> list[str]:
    failures: list[str] = []
    before = case["before"]["blocks"]
    after = case["after"]["blocks"]
    expected = case["expected"]
    before_ids = {value["block_id"] for value in before.values()}
    after_ids = {value["block_id"] for value in after.values()}
    preserved = sorted(before_ids & after_ids)
    lost = sorted(before_ids - after_ids)
    expected_preserved = sorted(expected["preserved_block_ids"])
    expected_lost = sorted(expected["lost_block_ids"])
    if preserved != expected_preserved:
        failures.append(f"{case['case_id']}: preserved IDs {preserved} != expected {expected_preserved}")
    if lost != expected_lost:
        failures.append(f"{case['case_id']}: lost IDs {lost} != expected {expected_lost}")
    for key, record in after.items():
        if record["block_id"] in before_ids and record["content_hash"] != payload_hash(record["payload"]):
            failures.append(f"{case['case_id']}: content hash mismatch for {record['block_id']}")
        if record["block_id"] in before_ids and record["content_hash"] != before[key]["content_hash"]:
            failures.append(f"{case['case_id']}: content hash changed for {record['block_id']}")
    if case["transition"] == "stale-artifact":
        if expected["verdict"] != "stale-rejected" or sorted(expected.get("stale_block_ids", [])) != ["ART-001"]:
            failures.append(f"{case['case_id']}: stale artifact was not explicitly rejected")
    elif expected["verdict"] != "pass" or lost:
        failures.append(f"{case['case_id']}: supported transition lost protected context")
    return failures


def main() -> int:
    schema = load(SCHEMA)
    Draft7Validator.check_schema(schema)
    failures: list[str] = []
    cases = sorted(CASE_ROOT.glob("CTX-*.json"))
    for path in cases:
        case = load(path)
        failures.extend(f"{path.name}: {error.message}" for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(case))
        failures.extend(run_case(case))
    if len(cases) != 5:
        failures.append(f"expected 5 context cases, found {len(cases)}")
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        print(f"Context preservation tests failed — {len(failures)} failures", file=sys.stderr)
        return 1
    print("Context preservation tests passed — 5 cases, 0 failures")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

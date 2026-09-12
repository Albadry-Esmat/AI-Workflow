"""Validate Batch 7 end-to-end requirement traceability fixtures."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
CASE_ROOT = ROOT / "evals" / "traceability" / "cases"
SCHEMA = ROOT / "config" / "traceability-contract-schema.json"


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def check_case(case: dict) -> list[str]:
    failures: list[str] = []
    requirement_map = {item["requirement_id"]: item for item in case["requirements"]}
    links = {item["requirement_id"]: item for item in case["links"]}
    if set(requirement_map) != set(links):
        failures.append("requirement and link ID sets differ")
    critical = [item["requirement_id"] for item in case["requirements"] if item["priority"] == "critical"]
    fully_linked = []
    for req_id, requirement in requirement_map.items():
        link = links.get(req_id)
        if not link:
            continue
        fields = ["architecture_refs", "task_refs", "code_refs", "test_refs", "deployment_refs"]
        missing = [field for field in fields if not link.get(field)]
        if not missing:
            fully_linked.append(req_id)
        if requirement["priority"] == "critical" and missing:
            expected_violation = "critical_requirement_uncovered" if "test_refs" in missing else "critical_requirement_unimplemented"
            if expected_violation not in case.get("violations", []):
                failures.append(f"{req_id}: missing {missing} without {expected_violation} violation")
    if sorted(fully_linked) != sorted([item["requirement_id"] for item in case["requirements"] if item["requirement_id"] in fully_linked]):
        failures.append("fully-linked requirement accounting is inconsistent")
    expected_critical = len([req_id for req_id in critical if req_id in fully_linked])
    if case["coverage"]["critical_fully_linked"] != expected_critical:
        failures.append("critical_fully_linked does not match link evidence")
    expected_coverage = round(100 * len(fully_linked) / len(requirement_map), 2)
    if case["coverage"]["coverage_percent"] != expected_coverage:
        failures.append("coverage_percent does not match complete-link count")
    should_pass = not any(req_id not in fully_linked for req_id in critical)
    if case["verdict"] != ("pass" if should_pass else "block"):
        failures.append("verdict does not respect critical requirement coverage")
    if should_pass and case.get("violations"):
        failures.append("passing traceability case contains violations")
    return failures


def main() -> int:
    schema = load(SCHEMA)
    Draft7Validator.check_schema(schema)
    failures: list[str] = []
    paths = sorted(CASE_ROOT.glob("RTM-*.json"))
    for path in paths:
        case = load(path)
        failures.extend(f"{path.name}: {error.message}" for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(case))
        failures.extend(f"{path.name}: {failure}" for failure in check_case(case))
    if len(paths) != 2:
        failures.append(f"expected 2 traceability fixtures, found {len(paths)}")
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        print(f"Traceability validation failed — {len(failures)} failures", file=sys.stderr)
        return 1
    print("Traceability validation passed — 2 fixtures, critical coverage blocker verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

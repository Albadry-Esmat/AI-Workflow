#!/usr/bin/env python3
"""Validate Batch 5 quick-review evaluation definitions without executing tools."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
EVAL_ROOT = ROOT / "evals" / "quick-review"
CASE_ROOT = EVAL_ROOT / "cases"
FIXTURE_ROOT = EVAL_ROOT / "fixtures"
REPLAY_ROOT = EVAL_ROOT / "replays"
CASE_SCHEMA = ROOT / "config" / "evaluation-case-schema.json"
BUDGET_SCHEMA = ROOT / "config" / "budget-policy-schema.json"
BUDGET_PROFILE = ROOT / "config" / "budgets" / "quick-review-v1.json"
POLICY_SCHEMA = ROOT / "config" / "policy-profile-schema.json"
POLICY_PROFILE = ROOT / "config" / "policies" / "quick-review-read-only-v2.json"
RETRY_SCHEMA = ROOT / "config" / "retry-reason-taxonomy-schema.json"
RETRY_TAXONOMY = ROOT / "config" / "retry-reasons.json"


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def main() -> int:
    failures: list[str] = []
    try:
        schema = load(CASE_SCHEMA)
        Draft7Validator.check_schema(schema)
        validator = Draft7Validator(schema, format_checker=FormatChecker())
    except Exception as error:
        print(f"FAIL: evaluation-case schema invalid: {error}")
        return 1

    index = load(EVAL_ROOT / "index.json")
    for label, schema_path, value_path in [
        ("budget policy", BUDGET_SCHEMA, BUDGET_PROFILE),
        ("capability policy profile", POLICY_SCHEMA, POLICY_PROFILE),
        ("retry taxonomy", RETRY_SCHEMA, RETRY_TAXONOMY),
    ]:
        try:
            config_schema = load(schema_path)
            Draft7Validator.check_schema(config_schema)
            config_errors = list(Draft7Validator(config_schema, format_checker=FormatChecker()).iter_errors(load(value_path)))
            failures.extend(f"{label}: {error.message}" for error in config_errors)
        except Exception as error:
            failures.append(f"{label}: cannot validate configuration: {error}")
    case_paths = sorted(CASE_ROOT.glob("*.json"))
    cases = []
    for path in case_paths:
        try:
            value = load(path)
        except Exception as error:
            failures.append(f"{path.name}: invalid JSON: {error}")
            continue
        errors = list(validator.iter_errors(value))
        failures.extend(f"{path.name}: {error.message}" for error in errors)
        cases.append(value)

    if len(cases) != 20:
        failures.append(f"expected 20 cases, found {len(cases)}")
    if len([case for case in cases if case.get("evaluation_class") == "golden"]) != 10:
        failures.append("expected 10 golden cases")
    if len([case for case in cases if case.get("evaluation_class") == "adversarial"]) != 10:
        failures.append("expected 10 adversarial cases")
    if index.get("case_count") != len(cases) or index.get("golden_count") != 10 or index.get("adversarial_count") != 10:
        failures.append("suite index counts do not match case corpus")
    if sorted(index.get("cases", [])) != sorted(case["case_id"] for case in cases):
        failures.append("suite index case set does not match case files")

    for fixture in ["web", "api", "data", "infra"]:
        path = FIXTURE_ROOT / fixture
        if not path.is_dir() or not any(path.rglob("*")):
            failures.append(f"missing or empty fixture: {fixture}")
    for case in cases:
        if case.get("execution_mode") == "replay" and not (REPLAY_ROOT / f"{case['case_id']}.json").exists():
            failures.append(f"missing replay trace for replay case {case['case_id']}")
    for path in REPLAY_ROOT.glob("*.json"):
        value = load(path)
        if value.get("replay_version") != "1.0.0" or not value.get("tool_responses"):
            failures.append(f"{path.name}: replay trace must be versioned and contain tool responses")
        if any("ghp_" in json.dumps(item) or "github_pat_" in json.dumps(item) for item in value.get("tool_responses", [])):
            failures.append(f"{path.name}: replay trace contains raw credential marker")

    print(f"Quick-review evaluation definitions: {len(cases)} cases, {len(list(REPLAY_ROOT.glob('*.json')))} replay traces")
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print("PASS: evaluation-case schema, corpus counts, fixtures, replay traces, and adversarial coverage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

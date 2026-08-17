"""Validate Batch 7 quality, traceability, context, and release controls."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def validate(schema_path: Path, value) -> list[str]:
    schema = load(schema_path) if isinstance(schema_path, Path) else schema_path
    Draft7Validator.check_schema(schema)
    return [error.message for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(value)]


def main() -> int:
    failures: list[str] = []
    checks = 0
    quality_schema = ROOT / "config" / "quality-vector-schema.json"
    quality_policy_schema = ROOT / "config" / "quality-policy-schema.json"
    quality_policy = load(ROOT / "config" / "quality-policy.json")
    eval_schema = ROOT / "config" / "evaluation-policy-schema.json"
    eval_policy = load(ROOT / "config" / "evaluation-policies.json")
    trace_schema = ROOT / "config" / "traceability-contract-schema.json"
    context_schema = ROOT / "config" / "context-preservation-schema.json"
    release_schema = ROOT / "config" / "release-compatibility-schema.json"

    for label, schema_path, value in [
        ("quality policy", quality_policy_schema, quality_policy),
        ("evaluation policy", eval_schema, eval_policy),
    ]:
        errors = validate(schema_path, value)
        if errors:
            failures.extend(f"{label}: {error}" for error in errors)
        else:
            checks += 1

    for label, schema_path in [
        ("quality vector schema", quality_schema),
        ("traceability schema", trace_schema),
        ("context preservation schema", context_schema),
        ("release compatibility schema", release_schema),
    ]:
        try:
            Draft7Validator.check_schema(load(schema_path))
            checks += 1
        except Exception as error:
            failures.append(f"{label}: {error}")

    dimensions = quality_policy["dimensions"]
    if abs(sum(item["weight"] for item in dimensions.values()) - 1.0) < 1e-9 and len(dimensions) == 9:
        checks += 1
    else:
        failures.append("quality vector weights must contain exactly nine dimensions and sum to 1.0")

    expected_blockers = {
        "security_contract_violation", "execution_contract_invalid", "critical_requirement_uncovered",
        "critical_requirement_unimplemented", "context_loss", "release_incompatible",
    }
    blocker_codes = {item["code"] for item in quality_policy["hard_blockers"]}
    if expected_blockers <= blocker_codes:
        checks += 1
    else:
        failures.append("quality policy is missing one or more score-independent hard blockers")

    policy_names = {item["name"] for item in eval_policy["policies"]}
    if policy_names == {"commit", "pull-request", "dev", "nightly", "release"} and all(item["blocking"] and not item["external_writes_allowed"] for item in eval_policy["policies"]):
        checks += 1
    else:
        failures.append("evaluation policy must define blocking, no-external-write commit/PR/Dev/nightly/release tiers")

    required_policy_checks = {
        "commit": {"validate-batch7-controls"},
        "pull-request": {"traceability", "context-preservation", "quality-vector"},
        "dev": {"website-data-sync-check", "release-compatibility"},
        "nightly": {"full-quick-review-evaluation"},
        "release": {"deployment-approval"},
    }
    if all(required <= {check for check in item["required_checks"]} for item in eval_policy["policies"] for required in [required_policy_checks[item["name"]]]):
        checks += 1
    else:
        failures.append("evaluation tiers are missing required Batch 7 checks")

    case_root = ROOT / "evals" / "context-preservation" / "cases"
    case_paths = sorted(case_root.glob("CTX-*.json"))
    if len(case_paths) != 5:
        failures.append(f"expected 5 context-preservation cases, found {len(case_paths)}")
    else:
        case_errors = []
        for path in case_paths:
            case_errors.extend(f"{path.name}: {error}" for error in validate(context_schema, load(path)))
        if case_errors:
            failures.extend(case_errors)
        else:
            checks += 1

    pass_vector = {
        "schema_version": "1.0.0",
        "run_id": "batch7-pass",
        "dimensions": {name: {"score": 95, "weight": item["weight"], "status": "pass", "evidence_refs": [f"check:{name}"]} for name, item in dimensions.items()},
        "weighted_score": 95,
        "blockers": [],
        "verdict": "pass",
    }
    blocker_vector = dict(pass_vector, run_id="batch7-block", weighted_score=99, blockers=[{
        "code": "execution_contract_invalid", "severity": "critical", "blocking": True,
        "reason": "fixture", "evidence_refs": ["contract:invalid"],
    }], verdict="block")
    for label, vector in [("passing quality vector", pass_vector), ("blocking quality vector", blocker_vector)]:
        errors = validate(quality_schema, vector)
        if errors:
            failures.extend(f"{label}: {error}" for error in errors)
        else:
            checks += 1

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        print(f"Batch 7 control validation failed — {checks} checks passed, {len(failures)} failed", file=sys.stderr)
        return 1
    print(f"Batch 7 control validation passed — {checks} checks passed, 0 failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Evaluate model/provider compatibility and verify deterministic rollback behavior."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "config/model-compatibility-policy.json"
SCHEMA_PATH = ROOT / "config/model-compatibility-policy-schema.json"


def main() -> int:
    policy = json.loads(POLICY_PATH.read_text())
    schema = json.loads(SCHEMA_PATH.read_text())
    errors = list(Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(policy))
    failures: list[str] = [error.message for error in errors]
    required = set(policy["required_capabilities"])
    results = []
    for model in policy["models"]:
        missing = sorted(required - set(model["capabilities"]))
        actual = "compatible" if model["contract_version"] == "1.1.0" and not missing else "incompatible"
        rollback = None if actual == "compatible" else policy["rollback_policy"]["last_known_good"]
        if actual != model["expected"]:
            failures.append(f"{model['model_id']}: expected {model['expected']}, measured {actual}")
        if actual == "incompatible" and rollback != policy["rollback_policy"]["last_known_good"]:
            failures.append(f"{model['model_id']}: incompatible model lacks last-known-good rollback")
        results.append({"model_id": model["model_id"], "provider": model["provider"], "measured": actual, "missing_capabilities": missing, "rollback_to": rollback, "promotion_allowed": actual == "compatible"})
    report = {
        "schema_version": "1.0.0",
        "policy_version": policy["policy_version"],
        "last_known_good": policy["rollback_policy"]["last_known_good"],
        "results": results,
        "rollback_verified": all(item["measured"] == "compatible" or item["rollback_to"] == report_last for item in results for report_last in [policy["rollback_policy"]["last_known_good"]]),
        "verdict": "pass" if not failures else "block",
        "limitations": ["Compatibility fixtures verify contract and evidence capability declarations; they do not call external model providers or measure model quality."],
    }
    output = ROOT / "artifacts/model-compatibility-report.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

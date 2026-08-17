"""Validate Batch 6 budget, retry, and capability-policy controls."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_ROOT = ROOT / "config" / "execution-contracts"
FIXTURE_ROOT = CONTRACT_ROOT / "fixtures" / "valid"


def load(path: Path) -> dict:
    with path.open() as handle:
        return json.load(handle)


def validate(schema_path: Path, value_path: Path) -> list[str]:
    schema = load(schema_path)
    Draft7Validator.check_schema(schema)
    return [error.message for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(load(value_path))]


def main() -> int:
    failures: list[str] = []
    checks = 0
    budget_schema = ROOT / "config" / "budget-policy-schema.json"
    budget_profile = ROOT / "config" / "budgets" / "quick-review-v1.json"
    policy_schema = ROOT / "config" / "policy-profile-schema.json"
    policy_profile = ROOT / "config" / "policies" / "quick-review-read-only-v2.json"
    retry_schema = ROOT / "config" / "retry-reason-taxonomy-schema.json"
    retry_taxonomy = ROOT / "config" / "retry-reasons.json"

    for label, schema, value in [
        ("budget profile", budget_schema, budget_profile),
        ("capability policy profile", policy_schema, policy_profile),
        ("retry taxonomy", retry_schema, retry_taxonomy),
    ]:
        errors = validate(schema, value)
        if errors:
            failures.extend(f"{label}: {error}" for error in errors)
        else:
            checks += 1

    budget = load(budget_profile)
    policy = load(policy_profile)
    retry = load(retry_taxonomy)

    if policy.get("enforced") is True and policy.get("enforcement_boundary") == "local-adapter":
        checks += 1
    else:
        failures.append("capability policy must declare enforced=true at the local-adapter boundary")

    required_actions = {"write", "delete", "commit", "push", "deploy", "publish", "credential-access"}
    if required_actions <= set(policy.get("required_policy_actions", [])):
        checks += 1
    else:
        failures.append("capability policy is missing one or more required approval actions")

    action_tiers = policy.get("action_tiers", {})
    if all(action_tiers.get(action) in {"medium", "high", "critical"} for action in required_actions) and all(action in policy.get("approval_required_tiers", []) or action not in policy.get("allowed_actions", []) or action_tiers.get(action) in {"high", "critical"} for action in required_actions):
        checks += 1
    else:
        failures.append("required actions are not classified or restricted consistently with approval policy")

    if {"high", "critical"} <= set(policy.get("approval_required_tiers", [])):
        checks += 1
    else:
        failures.append("high and critical tiers must require approval")

    if set(policy.get("denied_capabilities", [])) >= {"filesystem-write", "network", "deployment", "credential-use", "external-mcp"}:
        checks += 1
    else:
        failures.append("read-only policy does not deny all high-impact capability classes")

    if set(policy.get("allowed_actions", [])) == {"read", "execute"} and policy.get("default_decision") == "deny":
        checks += 1
    else:
        failures.append("quick-review policy must allow only read/execute and default to deny")

    retry_codes = [item.get("code") for item in retry.get("reasons", [])]
    if len(retry_codes) == len(set(retry_codes)) and {"BUDGET_EXCEEDED", "CANCELLED", "TOOL_EXECUTION_FAILED"} <= set(retry_codes):
        checks += 1
    else:
        failures.append("retry taxonomy is missing unique required terminal classifications")

    if budget["per_run"]["max_retries"] >= budget["per_step"]["max_attempts"] - 1 and budget["retry_policy"]["max_attempts"] == budget["per_step"]["max_attempts"]:
        checks += 1
    else:
        failures.append("run retry budget and per-step retry policy are inconsistent")

    for contract_type, expected_version in [("run-manifest", "1.1.0"), ("step-execution", "1.1.0"), ("policy-decision", "1.1.0")]:
        schema_path = CONTRACT_ROOT / f"{contract_type}.schema.json"
        fixture_path = FIXTURE_ROOT / f"{contract_type}.json"
        errors = validate(schema_path, fixture_path)
        if errors:
            failures.extend(f"{contract_type}: {error}" for error in errors)
        elif load(fixture_path).get("contract_version") == expected_version:
            checks += 1
        else:
            failures.append(f"{contract_type}: valid fixture is not contract {expected_version}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        print(f"Batch 6 control validation failed — {checks} checks passed, {len(failures)} failed", file=sys.stderr)
        return 1
    print(f"Batch 6 control validation passed — {checks} checks passed, 0 failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

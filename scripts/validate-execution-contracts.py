#!/usr/bin/env python3
"""Validate the versioned AI-Workflow execution contract family and fixtures."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "config" / "execution-contracts"
FIXTURE_DIR = CONTRACT_DIR / "fixtures"


def load_json(path: Path):
    with path.open() as handle:
        return json.load(handle)


def schema_validator(schema: dict) -> Draft7Validator:
    return Draft7Validator(schema, format_checker=FormatChecker())


def errors_for(validator: Draft7Validator, instance: dict) -> list[str]:
    return [error.message for error in sorted(validator.iter_errors(instance), key=lambda error: list(error.path))]


def main() -> int:
    failures: list[str] = []
    passes = 0
    index_path = CONTRACT_DIR / "index.json"
    try:
        index = load_json(index_path)
    except Exception as error:
        print(f"FAIL: cannot load contract index: {error}", file=sys.stderr)
        return 1

    contracts = index.get("contracts", [])
    if index.get("family_version") != "1.0.0":
        failures.append("contract family version must be 1.0.0")
    if len({item.get("contract_type") for item in contracts}) != len(contracts):
        failures.append("contract index contains duplicate contract types")

    validators: dict[str, Draft7Validator] = {}
    valid_instances: dict[str, dict] = {}
    for entry in contracts:
        contract_type = entry.get("contract_type")
        schema_path = CONTRACT_DIR / entry.get("schema", "")
        try:
            schema = load_json(schema_path)
        except Exception as error:
            failures.append(f"{contract_type}: cannot load schema: {error}")
            continue
        if schema.get("$id", "").endswith("/"):
            failures.append(f"{contract_type}: schema $id is not specific")
        if schema.get("properties", {}).get("contract_type", {}).get("const") != contract_type:
            failures.append(f"{contract_type}: schema contract_type const does not match index")
        if schema.get("properties", {}).get("contract_version", {}).get("const") != entry.get("contract_version"):
            failures.append(f"{contract_type}: schema contract_version const does not match index")
        validator = schema_validator(schema)
        validators[contract_type] = validator
        valid_path = FIXTURE_DIR / "valid" / f"{contract_type}.json"
        invalid_path = FIXTURE_DIR / "invalid" / f"{contract_type}.json"
        try:
            valid_instance = load_json(valid_path)
            valid_instances[contract_type] = valid_instance
        except Exception as error:
            failures.append(f"{contract_type}: cannot load valid fixture: {error}")
            continue
        valid_errors = errors_for(validator, valid_instance)
        if valid_errors:
            failures.append(f"{contract_type}: valid fixture rejected: {'; '.join(valid_errors)}")
        else:
            passes += 1
        try:
            invalid_instance = load_json(invalid_path)
        except Exception as error:
            failures.append(f"{contract_type}: cannot load invalid fixture: {error}")
            continue
        invalid_errors = errors_for(validator, invalid_instance)
        if not invalid_errors:
            failures.append(f"{contract_type}: invalid fixture was accepted")
        else:
            passes += 1

    # Cross-contract relationship checks for the canonical valid fixtures.
    manifest = valid_instances.get("run-manifest", {})
    expected = {
        "step_ids": {item["step_id"] for item in [valid_instances.get("step-execution", {})]},
        "artifact_ids": {valid_instances.get("artifact-reference", {}).get("artifact_id")},
        "gate_decision_ids": {valid_instances.get("gate-decision", {}).get("gate_id")},
        "policy_decision_ids": {valid_instances.get("policy-decision", {}).get("policy_decision_id")},
    }
    for field, identifiers in expected.items():
        if identifiers and identifiers <= set(manifest.get(field, [])):
            passes += 1
        else:
            failures.append(f"run-manifest relationship missing {field}: {sorted(identifiers)}")

    step = valid_instances.get("step-execution", {})
    if step.get("policy_decision_id") in manifest.get("policy_decision_ids", []):
        passes += 1
    else:
        failures.append("step-execution policy decision is not referenced by run-manifest")

    gate = valid_instances.get("gate-decision", {})
    if gate.get("run_id") == manifest.get("run_id") and gate.get("decision") == "approved":
        passes += 1
    else:
        failures.append("gate-decision does not relate to the approved canonical run")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        print(f"Execution contract validation failed — {passes} checks passed, {len(failures)} failed", file=sys.stderr)
        return 1
    print(f"All execution contract checks passed — {passes} checks passed, 0 failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

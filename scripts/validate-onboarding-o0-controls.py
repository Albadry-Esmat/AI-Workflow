#!/usr/bin/env python3
"""Validate Onboarding Batch O0 contracts and fail-closed invariants."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker


EXPECTED_ADAPTERS = {"opencode", "claude-code", "codex", "copilot-cli", "antigravity", "cursor", "gemini-cli", "aider", "generic-command"}
ROOT = Path(__file__).resolve().parents[1]


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_json(instance: Any, schema_path: Path, schema: Any | None = None) -> list[str]:
    schema = schema if schema is not None else load(schema_path)
    validator = Draft7Validator(schema, format_checker=FormatChecker())
    return [error.message for error in sorted(validator.iter_errors(instance), key=lambda e: list(e.path))]


def check(condition: bool, label: str, failures: list[str]) -> None:
    if condition:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label}")
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    failures: list[str] = []

    adapter_schema_path = root / "config/agent-runtime-adapter-schema.json"
    adapter_catalog_path = root / "config/agent-runtime-catalog.json"
    policy_schema_path = root / "config/agent-runtime-policy-schema.json"
    policy_path = root / "config/agent-runtime-policy.json"
    onboarding_schema_path = root / "config/onboarding-o0-schema.json"
    onboarding_path = root / "config/onboarding-o0-contract.json"
    fixtures_path = root / "evals/onboarding-o0/fixtures.json"

    for path in [adapter_schema_path, adapter_catalog_path, policy_schema_path, policy_path, onboarding_schema_path, onboarding_path, fixtures_path]:
        check(path.is_file(), f"required O0 file exists: {path.relative_to(root)}", failures)

    if failures:
        return 1

    adapter_schema = load(adapter_schema_path)
    adapter_catalog = load(adapter_catalog_path)
    policy_schema = load(policy_schema_path)
    policy = load(policy_path)
    onboarding_schema = load(onboarding_schema_path)
    onboarding = load(onboarding_path)
    fixtures = load(fixtures_path)

    for label, instance, schema_path, schema in [
        ("adapter catalog", adapter_catalog, adapter_schema_path, adapter_schema),
        ("policy instance", policy, policy_schema_path, policy_schema),
        ("onboarding contract", onboarding, onboarding_schema_path, onboarding_schema),
    ]:
        errors = validate_json(instance, schema_path, schema)
        check(not errors, f"{label} validates", failures)
        for error in errors[:5]:
            print(f"  detail: {error}")

    adapter_ids = {adapter["id"] for adapter in adapter_catalog["adapters"]}
    check(adapter_ids == EXPECTED_ADAPTERS, "catalog contains exactly the four O0 adapters", failures)
    check(set(policy["initial_adapters"]) == EXPECTED_ADAPTERS, "policy initial_adapters matches the catalog set", failures)
    check(policy["core_neutrality"]["agent_runtime_is_adapter"], "agent runtime is modeled as an adapter", failures)
    check(policy["core_neutrality"]["core_must_not_require_named_runtime"], "core does not require a named runtime", failures)
    check(policy["selection"]["explicit_selection_no_fallback"], "explicit adapter selection never silently falls back", failures)
    check(policy["selection"]["auto_selection_deterministic"], "automatic adapter selection is deterministic", failures)
    check(policy["selection"]["selection_recorded_in_run_manifest"], "adapter selection is recorded in evidence", failures)
    check(policy["installation"]["aiw_installs_runtime_by_default"] is False, "AI-Workflow does not install runtimes by default", failures)
    check(policy["authentication"]["no_secret_demo_required"], "no-secret demo is required", failures)
    check(policy["authentication"]["aiw_must_not_store_raw_secrets"] is True, "AI-Workflow must not store raw secrets", failures)
    check(policy["authentication"]["runtime_auth_delegated"], "runtime authentication is delegated", failures)
    check(policy["support_claims"]["first_class_requires_fixture"], "first-class claims require fixtures", failures)
    check(policy["support_claims"]["generic_must_not_claim_safety"], "generic adapter cannot claim runtime safety", failures)
    check(policy["evidence"]["unknown_capabilities_fail_closed"], "unknown capabilities fail closed", failures)

    for adapter in adapter_catalog["adapters"]:
        aid = adapter["id"]
        check(adapter["installation"]["managed_by_aiw"] is False, f"{aid}: runtime installation is user-controlled", failures)
        check(adapter["installation"]["requires_explicit_consent"] is True, f"{aid}: installation requires explicit consent", failures)
        check(adapter["authentication"]["aiw_handles_secret_values"] is False, f"{aid}: AI-Workflow does not handle raw secrets", failures)
        check(adapter["project_context"]["secret_copy_allowed"] is False, f"{aid}: target initialization cannot copy secrets", failures)
        check(adapter["launch"]["target_cwd"] is True, f"{aid}: launch has an explicit target context", failures)
        check(adapter["launch"]["explicit_agent_selection_supported"] is True, f"{aid}: explicit selection is supported by the contract", failures)
        check(adapter["evidence"]["external_writes_default"] is False, f"{aid}: external writes default to false", failures)
        if adapter["support_level"] == "first-class":
            check(adapter["documentation"]["verification_state"] == "fixture-verified", f"{aid}: first-class status has verified fixtures", failures)
        if aid == "generic-command":
            check(adapter["support_level"] == "generic", "generic command is not first-class", failures)
            check(adapter["safety"]["external_write_claim"] == "not-claimed", "generic command makes no external-write safety claim", failures)
            check(adapter["evidence"]["evidence_level"] == "none", "generic command makes no evidence-level claim", failures)

    lane_ids = {lane["id"] for lane in onboarding["lanes"]}
    check(lane_ids == {"native", "project-local", "dev-container"}, "onboarding contract defines all three installation lanes", failures)
    check(onboarding["authentication_boundaries"]["aiw_secret_storage"] == "none", "O0 forbids AI-Workflow raw-secret storage", failures)
    check(onboarding["authentication_boundaries"]["no_secret_demo"] is True, "onboarding contract provides a no-secret path", failures)
    check(onboarding["authentication_boundaries"]["log_redaction"] is True, "onboarding contract requires log redaction", failures)
    check(onboarding["rollback"]["no_runtime_install_by_default"] is True, "O0 rollback boundary includes no runtime installation", failures)
    check(len(onboarding["baseline_metrics"]) >= 8, "O0 defines baseline and hard-gate metrics", failures)

    fixture_ids = {fixture["id"] for fixture in fixtures["fixtures"]}
    required_fixture_ids = {
        "catalog-has-four-initial-adapters",
        "explicit-selection-missing-adapter-blocks",
        "explicit-selection-does-not-fallback",
        "no-secret-demo",
        "raw-secret-handling-blocks",
        "generic-command-does-not-claim-safety",
        "first-class-without-fixture-blocks",
        "rollback-keeps-runtime-uninstalled",
    }
    check(fixture_ids == required_fixture_ids, "O0 fixture set covers required safety scenarios", failures)

    print()
    if failures:
        print(f"BATCH O0 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print("BATCH O0 VALIDATION PASSED: all contract and policy checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

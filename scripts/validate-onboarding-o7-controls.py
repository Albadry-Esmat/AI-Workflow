"""Validate Onboarding O7 vendor-neutral verifier adapters and refresh controls."""
from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
CATALOG = ROOT / "config/verifier-adapter-o7-catalog.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def schema_errors(data: dict, schema: dict) -> list[str]:
    return [error.message for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(data)]


def run(args: list[str], env: dict[str, str] | None = None, expect: int = 0) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    merged.update(env or {})
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, env=merged, check=False)
    if result.returncode != expect:
        raise AssertionError(f"returned {result.returncode}, expected {expect}: {' '.join(args)}\nstdout={result.stdout}\nstderr={result.stderr}")
    return result


def main() -> int:
    failures: list[str] = []
    passed: list[str] = []

    def check(name: str, condition: bool) -> None:
        if condition:
            passed.append(name)
            print(f"PASS: {name}")
        else:
            failures.append(name)
            print(f"FAIL: {name}")

    catalog_schema = load(ROOT / "config/verifier-adapter-o7-catalog-schema.json")
    state_schema = load(ROOT / "config/onboarding-o7-state-schema.json")
    policy_schema = load(ROOT / "config/onboarding-o7-policy-schema.json")
    policy = load(ROOT / "config/onboarding-o7-policy.json")
    contract = load(ROOT / "config/onboarding-o7-contract.json")
    catalog = load(CATALOG)
    fixtures = load(ROOT / "evals/onboarding-o7/fixtures.json")

    check("catalog schema is valid JSON Schema", catalog_schema.get("type") == "object")
    check("state schema is valid JSON Schema", state_schema.get("type") == "object")
    check("policy schema is valid JSON Schema", policy_schema.get("type") == "object")
    policy_errors = schema_errors(policy, policy_schema)
    catalog_errors = schema_errors(catalog, catalog_schema)
    check("policy validates", not policy_errors)
    if policy_errors:
        print(f"  details: {policy_errors[:3]}")
    check("catalog validates", not catalog_errors)
    if catalog_errors:
        print(f"  details: {catalog_errors[:3]}")

    check("state is owned, atomic, redacted, and fail-closed", policy["state"] == {"owned_root": ".aiw/onboarding-o7", "atomic_writes": True, "redact_secrets": True, "unknown_state_fails_closed": True})
    check("adapter selection is exact, neutral, and fail-closed", policy["adapters"] == {"catalog_path": "config/verifier-adapter-o7-catalog.json", "catalog_schema_path": "config/verifier-adapter-o7-catalog-schema.json", "exact_record_required": True, "unknown_adapter_fails_closed": True, "vendor_neutral": True})
    check("offline verification is the default and claims are required", policy["verification"] == {"default_mode": "offline-bundle", "offline_bundle_allowed": True, "offline_key_allowed": True, "online_requires_consent": True, "claims_required": True, "unknown_claims": "fail-closed", "tool_installation": "manual-only"})
    check("network refresh is explicit, bounded, candidate-only, and never overwrites active roots", policy["network_refresh"]["default"] == "disabled" and policy["network_refresh"]["explicit_command"] == "refresh-plan-then-apply" and policy["network_refresh"]["consent_flag"] == "--yes" and policy["network_refresh"]["allowlist_required"] and policy["network_refresh"]["active_root_overwrite"] is False and policy["network_refresh"]["source_digest_required"] and policy["network_refresh"]["evidence_required"])
    check("external verifier tooling is closed and never auto-installed", policy["tooling"] == {"auto_install": False, "shell": False, "elevated": False, "stdin": "closed", "environment": "empty", "missing_tool": "fail-closed"})
    check("claim policy is strict", all(policy["claims"][key] is True for key in ["subject_digest", "identity", "issuer", "repository", "signer", "predicate_type", "workflow_or_build", "external_parameters"]) and policy["claims"]["unknown_fields"] == "fail-closed")
    check("installation, execution, auth, target, and launch remain disabled", policy["execution"] == {"install_allowed": False, "execute_allowed": False, "network_default": "disabled", "target_project_mutations": 0, "authentication": "deferred", "target_initialization": "deferred", "launch": "deferred"})
    check("recovery preserves candidates and active roots", policy["recovery"] == {"owned_paths_only": True, "candidate_preserved": True, "active_root_untouched": True, "target_project_untouched": True, "recover_command": "aiw onboarding recover --o7"})
    check("contract exposes plan, verify, refresh-plan, refresh, and recovery", {"verifier-plan", "verifier-verify", "verifier-refresh-plan", "verifier-refresh", "recover"}.issubset(contract["commands"]))
    check("contract keeps online refresh explicit and mutation-free", contract["network_refresh"]["default"] == "disabled" and contract["network_refresh"]["active_root_overwrite"] == "not-authorized" and contract["execution"]["target_project_mutations"] == 0)

    records = catalog["records"]
    check("catalog has four neutral records", len(records) == 4)
    check("catalog covers GitHub, Cosign, npm, and local delegate", {record["kind"] for record in records} == {"github-cli", "cosign", "npm-cli", "local-fixture"})
    check("all records are no-install/no-execute", all(record["authority"] == {"installation": False, "execution": False, "authentication": "deferred", "target_mutations": 0, "launch": "deferred"} for record in records))
    fingerprints_ok = True
    for record in records:
        unsigned = copy.deepcopy(record)
        actual = unsigned.pop("record_fingerprint")
        expected = "sha256:" + hashlib.sha256(json.dumps(unsigned, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        fingerprints_ok = fingerprints_ok and actual == expected
    check("all catalog fingerprints are deterministic and non-placeholder", fingerprints_ok and all(record["record_fingerprint"] != "sha256:" + "0" * 64 for record in records))
    check("all adapter claim requirements are strict", all(record["claim_requirements"]["unknown_claims"] == "fail-closed" and all(record["claim_requirements"][key] for key in ["artifact_subject", "identity", "repository", "signer", "predicate_type", "workflow_or_build", "external_parameters"]) for record in records))
    check("all refresh records have allowlists, budgets, evidence, and blocked root overwrite", all(record["network"]["default"] == "disabled" and record["network"]["timeout_seconds"] <= 30 and record["network"]["max_response_bytes"] <= 1048576 and record["network"]["active_root_overwrite"] is False and record["network"]["evidence_required"] is True for record in records))
    check("all evidence records are JSON and redacted", all(record["evidence"] == {"format": "json", "json_output": True, "source_url_required": True, "response_digest_required": True, "redacted": True} for record in records))
    fixture_ids = {fixture["id"] for fixture in fixtures["fixtures"]}
    required_fixtures = {"catalog-neutral", "catalog-fingerprints", "offline-default", "local-delegate-pass", "online-only-blocked", "missing-tool-fails", "refresh-plan", "refresh-consent", "host-allowlist", "candidate-isolated", "claims-strict", "no-auth", "no-target", "privacy-redaction", "unknown-adapter", "recovery-owned"}
    check("fixtures cover required O7 scenarios", required_fixtures.issubset(fixture_ids))

    with tempfile.TemporaryDirectory(prefix="aiw-o7-controls-") as raw:
        temp = Path(raw)
        staging = temp / "staging"
        state_root = temp / "state"
        staging.mkdir()
        artifact = staging / "safe-runtime-probe.py"
        shutil.copy2(ROOT / "evals/onboarding-o5/safe-runtime-probe.py", artifact)
        env = {"AIW_O7_STATE_ROOT": str(state_root), "AIW_O5_STAGING_ROOT": str(staging)}
        plan = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-plan", "--adapter", "auto", "--json"], env=env).stdout)
        check("adapter plan is offline-first and zero-network", plan["verdict"] == "pass" and len(plan["records"]) == 4 and plan["network"] == "disabled" and plan["requests"] == 0 and plan["raw_secret_values"] == 0)
        check("adapter plan blocks install, execute, auth, target, and launch", all(record["installation_authorized"] is False and record["execution_authorized"] is False and record["authentication"] == "deferred" and record["target_project_mutations"] == 0 and record["launch"] == "deferred" for record in plan["records"]))

        verified = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-verify", "--adapter", "LOCAL-FIXTURE-O6-DELEGATE", "--artifact", str(artifact), "--json"], env=env).stdout)
        check("local delegate passes offline verification", verified["verdict"] == "pass" and verified["verification"]["mode"] == "offline-bundle" and verified["verification"]["offline_result"] == "pass" and verified["verification"]["signature_valid"] and verified["verification"]["claims_valid"])
        check("local delegate records local redacted evidence", verified["evidence"]["source_provenance"] == "local" and verified["evidence"]["response_digest"].startswith("sha256:") and verified["evidence"]["redacted"] and verified["raw_secret_values"] == 0)
        check("local delegate preserves no-execution boundaries", verified["network"]["performed"] is False and verified["installation_authorized"] is False and verified["execution_authorized"] is False and verified["target"]["mutations"] == 0 and verified["authentication"]["raw_secret_values"] == 0)
        state = load(state_root / "state.json")
        state_errors = schema_errors(state, state_schema)
        check("verification state validates", not state_errors)
        if state_errors:
            print(f"  details: {state_errors[:3]}")

        npm = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-verify", "--adapter", "NPM-REGISTRY-PROVENANCE", "--artifact", str(artifact), "--json"], env=env, expect=1).stdout)
        check("online-only adapter fails closed without network", npm["verdict"] == "fail" and npm["network"]["performed"] is False and npm["installation_authorized"] is False and npm["execution_authorized"] is False)

        refresh_plan = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-refresh-plan", "--adapter", "GITHUB-CLI-ATTESTATION", "--json"], env=env).stdout)
        check("refresh plan exposes bounded candidate-only policy", refresh_plan["verdict"] == "pass" and refresh_plan["default_network"] == "disabled" and refresh_plan["active_root_overwrite"] is False and refresh_plan["source_digest_required"] and refresh_plan["evidence_required"] and refresh_plan["requests"] == 0)
        no_consent = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-refresh", "--adapter", "GITHUB-CLI-ATTESTATION", "--source-url", "https://api.github.com/meta", "--json"], env=env, expect=1).stdout)
        check("refresh requires explicit consent", no_consent["error_code"] == "O7-CONSENT-REQUIRED" and no_consent["network"] is False)
        blocked_host = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-refresh", "--adapter", "GITHUB-CLI-ATTESTATION", "--source-url", "https://evil.example.invalid/roots.json", "--yes", "--json"], env=env, expect=1).stdout)
        check("refresh rejects unallowlisted hosts before network", blocked_host["error_code"] == "O7-HOST-NOT-ALLOWLISTED" and blocked_host["network"] is False)

        unknown = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "verifier-verify", "--adapter", "UNKNOWN-O7", "--artifact", str(artifact), "--json"], env=env, expect=1).stdout)
        check("unknown adapter fails closed", unknown["verdict"] == "fail" and unknown["installation_authorized"] is False and unknown["execution_authorized"] is False)
        candidate = state_root / "candidates" / "test-candidate.json"
        candidate.parent.mkdir(parents=True)
        candidate.write_text("candidate evidence\n", encoding="utf-8")
        recovered = json.loads(run([PYTHON, "scripts/onboarding-o7.py", "recover", "--reset-state", "--json"], env=env).stdout)
        check("recovery resets owned state and preserves candidate evidence", recovered["verdict"] == "pass" and recovered["owned_paths_only"] and recovered["candidate_preserved"] and recovered["active_root_untouched"] and recovered["target_project_changes"] == 0 and candidate.exists())

    help_text = run([str(ROOT / "aiw"), "help"]).stdout
    check("CLI help exposes O7 commands", all(token in help_text for token in ["onboarding verifier-plan", "onboarding verifier-verify", "validate-onboarding-o7"]))
    routed = json.loads(run([str(ROOT / "aiw"), "onboarding", "verifier-plan", "--adapter", "auto", "--json"]).stdout)
    check("CLI routes O7 plan", routed["command"] == "aiw onboarding verifier-plan" and routed["network"] == "disabled")

    if failures:
        print(f"BATCH O7 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print(f"BATCH O7 VALIDATION PASSED: {len(passed)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

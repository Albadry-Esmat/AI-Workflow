"""Validate Onboarding O6 offline publisher-signature and attestation controls."""
from __future__ import annotations

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
BUNDLE = ROOT / "config/attestations/o6/controlled-fixture-attestation.json"
TRUST_ROOT = ROOT / "config/attestations/o6/controlled-fixture-trust-root.json"


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

    state_schema = load(ROOT / "config/onboarding-o6-state-schema.json")
    policy_schema = load(ROOT / "config/onboarding-o6-policy-schema.json")
    trust_schema = load(ROOT / "config/onboarding-o6-trust-root-schema.json")
    catalog_schema = load(ROOT / "config/runtime-attestation-o6-catalog-schema.json")
    policy = load(ROOT / "config/onboarding-o6-policy.json")
    contract = load(ROOT / "config/onboarding-o6-contract.json")
    catalog = load(ROOT / "config/runtime-attestation-o6-catalog.json")
    trust_root = load(TRUST_ROOT)
    bundle = load(BUNDLE)
    fixtures = load(ROOT / "evals/onboarding-o6/fixtures.json")
    o5_catalog = load(ROOT / "config/runtime-installer-o5-catalog.json")

    def assert_schema(name: str, data: dict, schema: dict) -> None:
        errors = schema_errors(data, schema)
        check(name, not errors)
        if errors:
            print(f"  details: {errors[:3]}")

    check("state schema is valid JSON Schema", state_schema.get("type") == "object")
    check("policy schema is valid JSON Schema", policy_schema.get("type") == "object")
    check("trust-root schema is valid JSON Schema", trust_schema.get("type") == "object")
    check("catalog schema is valid JSON Schema", catalog_schema.get("type") == "object")
    assert_schema("policy validates", policy, policy_schema)
    assert_schema("catalog validates", catalog, catalog_schema)
    assert_schema("trust root validates", trust_root, trust_schema)
    check("state is owned, atomic, redacted, and fail-closed", policy["state"] == {"owned_root": ".aiw/onboarding-o6", "atomic_writes": True, "redact_secrets": True, "unknown_state_fails_closed": True})
    check("verification is offline, signed, digest-bound, and strict", all(policy["verification"][key] for key in ["offline_only", "signature_required", "subject_digest_required", "identity_required", "builder_required", "predicate_required", "external_parameters_strict", "missing_bundle_fails_closed"]) and policy["verification"]["network"] is False and policy["verification"]["transparency_mode"] == "local-evidence-only")
    check("trust roots are pinned and never refreshed online", all(policy["trust"][key] for key in ["pinned_root_required", "root_fingerprint_required", "unknown_root_fails_closed", "identity_allowlist_required"]) and policy["trust"]["network_refresh"] == "disabled")
    check("provenance claims are strict", all(policy["claims"][key] for key in ["source_repository_required", "commit_required", "build_type_required", "predicate_type_required", "external_parameters_strict", "unknown_fields_fail_closed"]))
    check("O6 has no installation or execution authority", policy["execution"] == {"install_allowed": False, "execute_allowed": False, "network": False, "target_project_mutations": 0, "authentication": "deferred", "attestation_only": True})
    check("authentication, target, and launch remain deferred", policy["authentication"]["raw_secret_input"] is False and policy["authentication"]["raw_secret_storage"] is False and policy["target"]["initialization"] == "deferred" and policy["target"]["mutations"] == 0 and policy["target"]["launch"] == "deferred")
    check("contract exposes O6 plan, verify, and recovery", {"attestation_plan", "attestation_verify", "recover"}.issubset(contract["commands"]))
    check("contract separates claims and keeps execution unauthorized", contract["verification"]["bundle_required"] and contract["verification"]["trust_root_required"] and contract["execution"]["installation"] == "not-authorized" and contract["execution"]["execution"] == "not-authorized")
    check("catalog has one fixture-verified record", len(catalog["records"]) == 1 and catalog["records"][0]["status"] == "fixture-verified")
    record = catalog["records"][0]
    o5_record = next(item for item in o5_catalog["records"] if item["installer_id"] == record["artifact_installer_id"])
    check("O6 record binds the O5 digest exactly", record["artifact_sha256"] == o5_record["artifact"]["expected_sha256"])
    check("bundle and trust-root references are repository-local", record["attestation_path"].startswith("config/attestations/o6/") and record["trust_root_path"].startswith("config/attestations/o6/"))
    check("bundle format is local and signature length is Ed25519", bundle["bundle_format"] == "o6-local-attestation-v1" and len(bundle["signature"]) == 88 and bundle["signature_algorithm"] == "ed25519")
    check("trust root uses pinned fixture identity and disabled refresh", trust_root["trust_root_id"] == record["trust_root_id"] and trust_root["source_kind"] == "controlled-fixture" and trust_root["network_refresh"] == "disabled")
    fixture_ids = {fixture["id"] for fixture in fixtures["fixtures"]}
    required_fixtures = {"plan-offline-only", "plan-execution-unauthorized", "subject-digest-match", "signature-valid", "trust-root-pinned", "artifact-mismatch", "signature-tampered", "bundle-missing", "claim-mismatch", "privacy-redaction", "recovery-owned"}
    check("fixtures cover required O6 scenarios", required_fixtures.issubset(fixture_ids))

    with tempfile.TemporaryDirectory(prefix="aiw-o6-controls-") as raw:
        temp = Path(raw)
        staging = temp / "staging"
        state_root = temp / "state"
        staging.mkdir()
        artifact = staging / "safe-runtime-probe.py"
        shutil.copy2(ROOT / "evals/onboarding-o5/safe-runtime-probe.py", artifact)
        env = {"AIW_O6_STATE_ROOT": str(state_root), "AIW_O5_STAGING_ROOT": str(staging)}

        plan = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "attestation-plan", "--agent", "auto", "--json"], env=env).stdout)
        check("attestation plan is offline and unauthorized", plan["verdict"] == "pass" and plan["network"] == "disabled" and plan["commands_executed"] == 0 and plan["target_project_mutations"] == 0 and plan["records"][0]["installation_authorized"] is False and plan["records"][0]["execution_authorized"] is False)

        verified = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "attestation-verify", "--attestation", "O6-CONTROLLED-FIXTURE", "--artifact", str(artifact), "--json"], env=env).stdout)
        check("valid local attestation passes", verified["verdict"] == "pass" and verified["signature"]["status"] == "passed" and verified["signature"]["signature_valid"] is True and verified["artifact"]["subject_match"] is True)
        check("all expected provenance claims pass", all(verified["claims"][key] for key in ["identity_match", "builder_match", "repository_match", "commit_match", "build_type_match", "predicate_match", "external_parameters_match"]))
        check("trust root and local transparency evidence pass", verified["trust"]["root_present"] and verified["trust"]["root_fingerprint_match"] and verified["trust"]["network"] is False and verified["trust"]["transparency_status"] == "local-evidence")
        state = load(state_root / "state.json")
        assert_schema("valid verification state validates", state, state_schema)
        check("verification state is redacted and no-execution", state["authentication"]["raw_secret_values"] == 0 and state["target"]["mutations"] == 0 and verified["installation_authorized"] is False and verified["execution_authorized"] is False)

        artifact.write_text(artifact.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        artifact_fail = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "attestation-verify", "--attestation", "O6-CONTROLLED-FIXTURE", "--artifact", str(artifact), "--json"], env=env, expect=1).stdout)
        check("subject digest mismatch fails closed", artifact_fail["verdict"] == "fail" and artifact_fail["artifact"]["subject_match"] is False and artifact_fail["installation_authorized"] is False and artifact_fail["execution_authorized"] is False)
        artifact.write_text(artifact.read_text(encoding="utf-8").rstrip("\n") + "\n", encoding="utf-8")

        bundle_backup = BUNDLE.read_bytes()
        try:
            tampered = load(BUNDLE)
            tampered["signature"] = "A" + tampered["signature"][1:]
            BUNDLE.write_text(json.dumps(tampered, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            signature_fail = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "attestation-verify", "--attestation", "O6-CONTROLLED-FIXTURE", "--artifact", str(artifact), "--json"], env=env, expect=1).stdout)
            check("tampered signature fails closed", signature_fail["verdict"] == "fail" and signature_fail["signature"]["signature_valid"] is False)
        finally:
            BUNDLE.write_bytes(bundle_backup)

        bundle_backup = BUNDLE.read_bytes()
        try:
            BUNDLE.unlink()
            missing = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "attestation-verify", "--attestation", "O6-CONTROLLED-FIXTURE", "--artifact", str(artifact), "--json"], env=env, expect=1).stdout)
            check("missing bundle fails closed", missing["verdict"] == "fail" and any("attestation bundle is missing" in reason for reason in missing["policy"]["reasons"]))
        finally:
            BUNDLE.write_bytes(bundle_backup)

        trust_backup = TRUST_ROOT.read_bytes()
        try:
            trust = load(TRUST_ROOT)
            trust["public_key_pem"] += "\n"
            TRUST_ROOT.write_text(json.dumps(trust, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            trust_fail = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "attestation-verify", "--attestation", "O6-CONTROLLED-FIXTURE", "--artifact", str(artifact), "--json"], env=env, expect=1).stdout)
            check("trust-root fingerprint mismatch fails closed", trust_fail["verdict"] == "fail" and trust_fail["trust"]["root_fingerprint_match"] is False)
        finally:
            TRUST_ROOT.write_bytes(trust_backup)

        recovered = json.loads(run([PYTHON, "scripts/onboarding-o6.py", "recover", "--reset-state", "--json"], env=env).stdout)
        check("recovery is owned and preserves artifact", recovered["verdict"] == "pass" and recovered["owned_paths_only"] and recovered["artifact_preserved"] and recovered["runtime_changes"] == 0 and recovered["target_project_changes"] == 0 and artifact.exists())

    help_text = run([str(ROOT / "aiw"), "help"]).stdout
    check("CLI exposes O6 commands", all(token in help_text for token in ["onboarding attestation-plan", "onboarding attestation-verify"]))
    routed = json.loads(run([str(ROOT / "aiw"), "onboarding", "attestation-plan", "--agent", "auto", "--json"]).stdout)
    check("CLI routes O6 plan", routed["command"] == "aiw onboarding attestation-plan" and routed["commands_executed"] == 0)

    if failures:
        print(f"BATCH O6 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print(f"BATCH O6 VALIDATION PASSED: {len(passed)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

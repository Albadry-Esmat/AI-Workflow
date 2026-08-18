"""Validate Onboarding O5 digest-bound local execution controls."""
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

    state_schema = load(ROOT / "config/onboarding-o5-state-schema.json")
    policy_schema = load(ROOT / "config/onboarding-o5-policy-schema.json")
    catalog_schema = load(ROOT / "config/runtime-installer-o5-catalog-schema.json")
    policy = load(ROOT / "config/onboarding-o5-policy.json")
    contract = load(ROOT / "config/onboarding-o5-contract.json")
    catalog = load(ROOT / "config/runtime-installer-o5-catalog.json")
    fixtures = load(ROOT / "evals/onboarding-o5/fixtures.json")

    check("state schema is valid JSON Schema", state_schema.get("type") == "object" and not schema_errors(state_schema, {"type": "object"}))
    check("policy schema is valid JSON Schema", policy_schema.get("type") == "object" and not schema_errors(policy_schema, {"type": "object"}))
    check("catalog schema is valid JSON Schema", catalog_schema.get("type") == "object" and not schema_errors(catalog_schema, {"type": "object"}))
    check("policy validates", not schema_errors(policy, policy_schema))
    check("catalog validates", not schema_errors(catalog, catalog_schema))
    check("state is owned, atomic, redacted, and fail-closed", policy["state"] == {"owned_root": ".aiw/onboarding-o5", "atomic_writes": True, "redact_secrets": True, "unknown_state_fails_closed": True})
    check("artifact hash and staging boundaries are required", all(policy["artifact"][key] for key in ["sha256_required", "size_required", "local_only", "staging_root_required", "path_traversal_blocked", "symlink_blocked"]))
    check("approval is exact and explicit", all(policy["approval"][key] for key in ["exact_record", "exact_path", "exact_digest", "platform_match", "reason_required", "explicit_yes_required", "unapproved_fails_closed"]))
    check("preflight is closed and zero-target", policy["preflight"]["network"] == "disabled" and policy["preflight"]["shell"] is False and policy["preflight"]["elevated"] is False and policy["preflight"]["stdin"] == "closed" and policy["preflight"]["environment_allowlist"] == [] and policy["preflight"]["target_project_mutations"] == 0)
    check("execution is local argv-only and bounded", policy["execution"]["local_argv_only"] and policy["execution"]["network"] is False and policy["execution"]["shell"] is False and policy["execution"]["elevated"] is False and policy["execution"]["max_commands"] == 1 and policy["execution"]["stdout_capture"] is False and policy["execution"]["stderr_capture"] is False)
    check("auth, target, and launch remain deferred", policy["authentication"]["login_automation"] == "deferred" and policy["authentication"]["raw_secret_input"] is False and policy["target"]["initialization"] == "deferred" and policy["target"]["mutations"] == 0 and policy["target"]["launch"] == "deferred")
    check("rollback is guidance-only and owned", policy["rollback"]["claim_policy"] == "record-only-unless-officially-supported" and policy["rollback"]["quarantine_owned_only"] and policy["rollback"]["target_untouched"])
    check("contract exposes O5 lifecycle commands", {"execute_plan", "artifact_hash", "execute", "recover"}.issubset(contract["commands"]))
    check("contract separates authentication, target, and launch", contract["commands"]["auth_login"]["status"] == "deferred-runtime-owned" and contract["commands"]["target_init"]["status"] == "deferred-guarded-batch" and contract["commands"]["start"]["status"] == "deferred-launch-adapter")
    check("catalog has one approved controlled fixture", len(catalog["records"]) == 1 and catalog["records"][0]["approval"]["status"] == "approved" and catalog["records"][0]["artifact"]["kind"] == "controlled-fixture")
    record = catalog["records"][0]
    check("catalog binds exact digest and size", record["artifact"]["expected_sha256"].startswith("sha256:") and record["artifact"]["expected_size_bytes"] == 127 and record["provenance"]["record_fingerprint"].startswith("sha256:"))
    check("catalog execution is closed and staging-owned", record["execution"]["shell"] is False and record["execution"]["network"] is False and record["execution"]["elevated"] is False and record["execution"]["cwd_policy"] == "o5-owned-staging" and record["execution"]["environment_policy"] == "allowlist-empty" and record["execution"]["target_project_mutations"] == 0)
    fixture_ids = {fixture["id"] for fixture in fixtures["fixtures"]}
    required_fixtures = {"plan-local-only", "hash-exact-match", "hash-mismatch", "path-outside-staging", "path-symlink-blocked", "consent-required", "approved-fixture-executes-one", "output-not-captured", "recovery-preserves-staging"}
    check("fixtures cover required O5 scenarios", required_fixtures.issubset(fixture_ids))

    with tempfile.TemporaryDirectory(prefix="aiw-o5-controls-") as raw:
        temp = Path(raw)
        staging = temp / "staging"
        state_root = temp / "state"
        staging.mkdir()
        fixture = staging / "safe-runtime-probe.py"
        shutil.copy2(ROOT / "evals/onboarding-o5/safe-runtime-probe.py", fixture)
        env = {"AIW_O5_STATE_ROOT": str(state_root), "AIW_O5_STAGING_ROOT": str(staging), "AIW_O5_PLATFORM": "linux", "AIW_O5_ARCH": "x64", "PATH": str(temp / "empty-bin")}

        plan = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "execute-plan", "--agent", "auto", "--json"], env=env).stdout)
        check("execution plan is zero-write and exact", plan["verdict"] == "pass" and plan["network"] == "disabled" and plan["mutations"] == 0 and plan["commands_executed"] == 0 and plan["target_project_mutations"] == 0 and plan["eligible_installer_ids"] == ["O5-FIXTURE-SAFE-RUNTIME-PROBE"])

        hashed = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "artifact-hash", "--installer", "O5-FIXTURE-SAFE-RUNTIME-PROBE", "--path", str(fixture), "--json"], env=env).stdout)
        check("exact artifact hash passes", hashed["verdict"] == "pass" and hashed["hash_status"] == "passed" and hashed["observed_sha256"] == record["artifact"]["expected_sha256"] and hashed["observed_size_bytes"] == record["artifact"]["expected_size_bytes"])
        state = load(state_root / "state.json")
        check("hash state validates and is redacted", not schema_errors(state, state_schema) and state["execution"]["commands_executed"] == 0 and state["authentication"]["raw_secret_values"] == 0)

        no_yes = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "execute", "--installer", "O5-FIXTURE-SAFE-RUNTIME-PROBE", "--path", str(fixture), "--reason", "missing explicit consent", "--json"], env=env, expect=1).stdout)
        check("execution requires explicit consent", no_yes["error_code"] == "O5-EXECUTION-BLOCKED" and any("explicit --yes is required" in reason for reason in no_yes["blocked_reasons"]) and no_yes["commands_executed"] == 0)

        success = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "execute", "--installer", "O5-FIXTURE-SAFE-RUNTIME-PROBE", "--path", str(fixture), "--reason", "approved controlled fixture verification", "--yes", "--json"], env=env).stdout)
        check("approved fixture executes exactly once", success["verdict"] == "pass" and success["execution"]["status"] == "passed" and success["execution"]["commands_executed"] == 1 and success["execution"]["exit_code"] == 0 and success["execution"]["host_mutations"] == 0 and success["target"]["mutations"] == 0)
        state = load(state_root / "state.json")
        check("execution state validates with no captured output", not schema_errors(state, state_schema) and state["execution"]["stdout_captured"] is False and state["execution"]["stderr_captured"] is False and state["authentication"]["login_started"] is False)

        fixture.write_text(fixture.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        mismatch = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "execute", "--installer", "O5-FIXTURE-SAFE-RUNTIME-PROBE", "--path", str(fixture), "--reason", "tampered artifact", "--yes", "--json"], env=env, expect=1).stdout)
        check("digest mismatch blocks before command", mismatch["error_code"] == "O5-EXECUTION-BLOCKED" and any("SHA-256" in reason or "size" in reason for reason in mismatch["blocked_reasons"]) and mismatch["commands_executed"] == 0)

        outside = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "execute", "--installer", "O5-FIXTURE-SAFE-RUNTIME-PROBE", "--path", str(temp / "safe-runtime-probe.py"), "--reason", "outside staging", "--yes", "--json"], env=env, expect=1).stdout)
        check("outside-staging path blocks before command", outside["error_code"] == "O5-EXECUTION-BLOCKED" and mismatch["commands_executed"] == 0)

        symlink = staging / "link.py"
        symlink.symlink_to(fixture)
        linked = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "artifact-hash", "--installer", "O5-FIXTURE-SAFE-RUNTIME-PROBE", "--path", str(symlink), "--json"], env=env, expect=1).stdout)
        check("symlink artifact blocks before hash", linked["hash_status"] == "blocked")

        recovered = json.loads(run([PYTHON, "scripts/onboarding-o5.py", "recover", "--reset-state", "--json"], env=env).stdout)
        check("recovery resets owned state and preserves staging", recovered["reset_state"] and recovered["owned_paths_only"] and recovered["staging_artifact_preserved"] and fixture.exists() and recovered["runtime_changes"] == 0 and recovered["target_project_changes"] == 0)

    help_text = run([str(ROOT / "aiw"), "help"]).stdout
    check("CLI exposes O5 commands", all(token in help_text for token in ["onboarding execute-plan", "onboarding artifact-hash", "onboarding execute"]))
    routed = json.loads(run([str(ROOT / "aiw"), "onboarding", "execute-plan", "--agent", "auto", "--json"]).stdout)
    check("CLI routes O5 plan", routed["command"] == "aiw onboarding execute-plan" and routed["commands_executed"] == 0)

    if failures:
        print(f"BATCH O5 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print(f"BATCH O5 VALIDATION PASSED: {len(passed)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Validate Onboarding O4 verified runtime installation controls."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def errors(data: dict, schema: dict) -> list[str]:
    return [error.message for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(data)]


def run(args: list[str], env: dict[str, str] | None = None, expect: int = 0) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    merged.update(env or {})
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, env=merged, check=False)
    if result.returncode != expect:
        raise AssertionError(f"command returned {result.returncode}, expected {expect}: {' '.join(args)}\nstdout={result.stdout}\nstderr={result.stderr}")
    return result


def main() -> int:
    failures: list[str] = []
    checks: list[str] = []

    def check(name: str, condition: bool) -> None:
        if condition:
            checks.append(name)
            print(f"PASS: {name}")
        else:
            failures.append(name)
            print(f"FAIL: {name}")

    state_schema = load(ROOT / "config/onboarding-o4-state-schema.json")
    policy_schema = load(ROOT / "config/onboarding-o4-policy-schema.json")
    catalog_schema = load(ROOT / "config/runtime-installer-catalog-schema.json")
    policy = load(ROOT / "config/onboarding-o4-policy.json")
    contract = load(ROOT / "config/onboarding-o4-contract.json")
    catalog = load(ROOT / "config/runtime-installer-catalog.json")
    fixtures = load(ROOT / "evals/onboarding-o4/fixtures.json")

    check("state schema is valid JSON Schema", not errors(state_schema, {"type": "object"}))
    check("policy schema is valid JSON Schema", not errors(policy_schema, {"type": "object"}))
    check("installer catalog schema is valid JSON Schema", not errors(catalog_schema, {"type": "object"}))
    check("policy validates", not errors(policy, policy_schema))
    check("catalog validates", not errors(catalog, catalog_schema))
    check("state is O4-owned, atomic, redacted, and fail-closed", policy["state"]["owned_root"] == ".aiw/onboarding-o4" and policy["state"]["atomic_writes"] and policy["state"]["redact_secrets"] and policy["state"]["unknown_state_fails_closed"])
    check("plan is disabled-network and zero-write", policy["planning"]["default_mode"] == "plan" and policy["planning"]["network"] == "disabled" and policy["planning"]["mutations"] == 0 and policy["planning"]["commands_executed"] == 0)
    check("catalog requires official provenance and exact records", all(policy["catalog"][key] for key in ["official_provenance_required", "review_status_required", "source_fingerprint_required", "exact_record_required"]))
    check("verification is read-only and bounded", policy["verification"]["read_only"] and policy["verification"]["version_probe_required"] and policy["verification"]["timeout_max_seconds"] <= 30 and policy["verification"]["secrets_seen"] is False)
    check("automatic installer execution is disabled", policy["execution"]["default_status"] == "manual-only" and policy["execution"]["current_eligible_records"] == [] and not policy["execution"]["pipe_to_shell_allowed"] and not policy["execution"]["elevated_allowed"] and not policy["execution"]["network_downloads_allowed"] and not policy["execution"]["package_manager_mutation_allowed"])
    check("authentication, target init, and launch remain deferred", policy["authentication"]["login_automation"] == "runtime-owned" and policy["authentication"]["raw_secret_input"] is False and policy["target"]["initialization"] == "deferred" and policy["target"]["mutations"] == 0 and policy["target"]["launch"] == "deferred")
    check("rollback claims require official guidance", policy["rollback"]["claim_policy"] == "record-only-unless-officially-supported" and policy["rollback"]["vendor_guidance_required"])
    check("contract exposes O4 plan, verify, install, and recovery", {"install_plan", "install_verify", "install", "recover"}.issubset(contract["commands"]))
    check("contract keeps auth, target, and launch deferred", contract["commands"]["auth_login"]["status"] == "deferred-runtime-owned" and contract["commands"]["target_init"]["status"] == "deferred-guarded-batch" and contract["commands"]["start"]["status"] == "deferred-launch-adapter")
    check("contract blocks all mutation classes", all(not contract["command_policy"][key]["allowed"] for key in ["shell_pipeline", "elevated", "network_download", "package_manager_mutation", "docker_mutation"]))
    check("catalog has nine source-reviewed manual-only records", len(catalog["records"]) == 9 and all(item["review"]["status"] == "source-reviewed" and item["command"]["execution_status"] == "manual-only" for item in catalog["records"]))
    check("catalog covers Linux, macOS, and Windows", {item["platform"] for item in catalog["records"]} == {"linux", "macos", "windows"})
    check("catalog records carry official fingerprints and read-only verification", all(item["provenance"]["source_kind"].startswith("official-") and item["provenance"]["source_fingerprint"].startswith("sha256:") and item["verification"]["read_only"] and item["rollback"]["target_project_impact"] == 0 for item in catalog["records"]))
    required_fixtures = {"plan-linux-bash-zero-write", "plan-windows-powershell-zero-write", "plan-macos-zsh-zero-write", "install-consent-required", "install-record-not-eligible", "verify-read-only", "recover-owned-state"}
    check("fixtures cover required O4 scenarios", required_fixtures.issubset({item["id"] for item in fixtures["fixtures"]}))

    with tempfile.TemporaryDirectory(prefix="aiw-o4-controls-") as raw:
        root = Path(raw)
        state_root = root / "o4-state"
        env = {"AIW_O4_STATE_ROOT": str(state_root), "PATH": str(root / "empty-bin")}
        plans: list[dict] = []
        for platform_name, shell in (("linux", "bash"), ("windows", "powershell"), ("macos", "zsh")):
            result = run([PYTHON, "scripts/onboarding-o4.py", "install-plan", "--agent", "auto", "--platform", platform_name, "--architecture", "x64", "--shell", shell, "--json"], env=env)
            data = json.loads(result.stdout)
            plans.append(data)
        check("cross-platform plans are zero-write and manual-only", all(item["verdict"] == "pass" and item["mutations"] == 0 and item["commands_executed"] == 0 and item["network"] == "disabled" and item["raw_secret_values"] == 0 and item["eligible_installer_ids"] == [] and all(record["automatic_execution"] == "blocked" for record in item["records"]) for item in plans) and not state_root.exists())

        no_consent = run([PYTHON, "scripts/onboarding-o4.py", "install", "--installer", "INS-OPENCODE-NATIVE-SCRIPT", "--json"], env=env, expect=1)
        no_consent_data = json.loads(no_consent.stdout)
        check("install requires explicit consent", no_consent_data["error_code"] == "O4-CONSENT-REQUIRED" and no_consent_data["commands_executed"] == 0)

        blocked = run([PYTHON, "scripts/onboarding-o4.py", "install", "--installer", "INS-OPENCODE-NATIVE-SCRIPT", "--yes", "--json"], env=env, expect=1)
        blocked_data = json.loads(blocked.stdout)
        check("manual-only installer remains blocked even after consent", blocked_data["error_code"] == "O4-INSTALL-NOT-ELIGIBLE" and blocked_data["commands_executed"] == 0 and blocked_data["host_mutations"] == 0 and blocked_data["target_project_mutations"] == 0 and state_root.exists())
        state = load(state_root / "state.json")
        check("install state validates as redacted O4 state", not errors(state, state_schema) and state["installation"]["commands_executed"] == 0 and state["authentication"]["raw_secret_values"] == 0 and state["target"]["mutations"] == 0)

        verify = run([PYTHON, "scripts/onboarding-o4.py", "install-verify", "--agent", "opencode", "--platform", "linux", "--architecture", "x64", "--shell", "bash", "--json"], env=env, expect=1)
        verify_data = json.loads(verify.stdout)
        check("verification is read-only and bounded", verify_data["probe"]["read_only"] and verify_data["probe"]["external_writes"] == 0 and verify_data["probe"]["secrets_seen"] is False and verify_data["installation"]["commands_executed"] == 0 and verify_data["target"]["mutations"] == 0)

        recover = run([PYTHON, "scripts/onboarding-o4.py", "recover", "--reset-state", "--json"], env=env)
        recover_data = json.loads(recover.stdout)
        check("O4 recovery removes only owned state", recover_data["reset_state"] and recover_data["owned_paths_only"] and recover_data["runtime_changes"] == 0 and recover_data["target_project_changes"] == 0 and not state_root.exists())

    cli_help = run([str(ROOT / "aiw"), "help"])
    check("CLI exposes O4 commands", all(token in cli_help.stdout for token in ["onboarding install-plan", "onboarding install-verify", "onboarding install"]))
    cli_plan = run([str(ROOT / "aiw"), "onboarding", "install-plan", "--agent", "auto", "--platform", "linux", "--architecture", "x64", "--shell", "bash", "--json"])
    cli_plan_data = json.loads(cli_plan.stdout)
    check("CLI routes O4 installer plan", cli_plan_data["command"] == "aiw onboarding install-plan" and cli_plan_data["mutations"] == 0)

    if failures:
        print(f"BATCH O4 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print(f"BATCH O4 VALIDATION PASSED: {len(checks)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

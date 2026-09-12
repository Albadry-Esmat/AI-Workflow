"""Validate Onboarding O3 guided onboarding and safety controls."""
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


def schema_errors(data: dict, schema: dict) -> list[str]:
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

    state_schema = load(ROOT / "config/onboarding-o3-state-schema.json")
    policy_schema = load(ROOT / "config/onboarding-o3-policy-schema.json")
    policy = load(ROOT / "config/onboarding-o3-policy.json")
    contract = load(ROOT / "config/onboarding-o3-contract.json")
    catalog = load(ROOT / "config/agent-runtime-catalog.json")
    fixtures = load(ROOT / "evals/onboarding-o3/fixtures.json")

    check("state schema is valid JSON Schema", not schema_errors(state_schema, {"type": "object"}))
    check("policy schema is valid JSON Schema", not schema_errors(policy_schema, {"type": "object"}))
    check("policy validates", not schema_errors(policy, policy_schema))
    check("O3 state is redacted and resumable", policy["state"]["redact_secrets"] and policy["state"]["resume_allowed"] and policy["state"]["unknown_state_fails_closed"])
    check("guided mode defaults to no-write plan", policy["guided"]["default_mode"] == "plan" and policy["guided"]["plan_mutations"] == 0 and policy["guided"]["plan_network"] == "disabled")
    check("apply requires explicit consent", policy["guided"]["apply_requires_explicit_yes"] is True)
    check("runtime installation is user-controlled and deferred", policy["runtime"]["installation"] == "user-controlled-deferred" and policy["runtime"]["installation_commands"] is False)
    check("selection is explicit and no-fallback", policy["runtime"]["explicit_missing_fails"] and policy["runtime"]["silent_fallback"] is False)
    check("authentication is delegated and raw-secret-free", policy["authentication"]["aiw_stores_raw_secrets"] is False and policy["authentication"]["raw_secret_input"] is False and policy["authentication"]["login_automation"] == "runtime-owned")
    check("target initialization and launch are deferred", policy["target"]["initialization"] == "deferred" and policy["target"]["mutation"] == 0 and policy["target"]["launch"] == "deferred")
    check("recovery is owned-path-only", policy["recovery"]["owned_paths_only"] and policy["recovery"]["target_untouched"] and policy["recovery"]["runtime_untouched"])
    check("contract has all O3 commands", {"plan", "apply", "doctor", "recover"}.issubset(contract["commands"]))
    check("contract keeps installation, auth, init, and launch deferred", contract["commands"]["runtime_install"]["status"] == "deferred-user-controlled" and contract["commands"]["auth_login"]["status"] == "deferred-runtime-owned" and contract["commands"]["target_init"]["status"] == "deferred-guarded-batch" and contract["commands"]["start"]["status"] == "deferred-launch-adapter")
    check("contract defines all onboarding lanes", set(contract["lanes"]) == {"native", "project-local", "dev-container"})
    check("catalog remains four agent-neutral adapters", {a["id"] for a in catalog["adapters"]} == {"opencode", "claude-code", "codex", "generic-command"})
    required_fixtures = {"plan-native-zero-write", "apply-requires-explicit-consent", "explicit-missing-fails", "auto-selection-defers", "installation-never-executed", "auth-delegated", "target-init-deferred", "recover-owned-state"}
    check("fixtures cover required O3 scenarios", required_fixtures.issubset({item["id"] for item in fixtures["fixtures"]}))

    with tempfile.TemporaryDirectory(prefix="aiw-o3-controls-") as raw:
        state_root = Path(raw) / "state"
        env = {"AIW_O3_STATE_ROOT": str(state_root), "AIW_O2_STATE_ROOT": str(Path(raw) / "o2-state")}
        plan_results = []
        for lane in ("native", "project-local", "dev-container"):
            result = run([PYTHON, "scripts/onboarding-o3.py", "plan", "--lane", lane, "--agent", "auto", "--json"], env=env)
            data = json.loads(result.stdout)
            plan_results.append(data)
        check("all lanes have deterministic zero-write plans", all(item["verdict"] == "pass" and item["mutations"] == 0 and item["network"] == "disabled" and item["raw_secret_values"] == 0 for item in plan_results) and not state_root.exists())
        consent = run([PYTHON, "scripts/onboarding-o3.py", "apply", "--lane", "native", "--agent", "auto", "--json"], env=env, expect=1)
        consent_data = json.loads(consent.stdout)
        check("apply without consent fails closed", consent_data["error_code"] == "O3-CONSENT-REQUIRED" and consent_data["mutations"] == 0)
        missing = run([PYTHON, "scripts/onboarding-o3.py", "apply", "--lane", "native", "--agent", "opencode", "--yes", "--json"], env={**env, "PATH": str(Path(raw) / "empty-bin")}, expect=1)
        missing_data = json.loads(missing.stdout)
        check("explicit missing runtime fails closed", missing_data["verdict"] == "fail" and missing_data["error_code"] == "O3-ADAPTER-MISSING" and missing_data["runtime_selection"]["fallback"] is False)
        doctor = run([PYTHON, "scripts/onboarding-o3.py", "doctor", "--json"], env=env)
        doctor_data = json.loads(doctor.stdout)
        check("doctor reports deferred runtime installation and redacted auth", doctor_data["installation"]["commands_executed"] == 0 and doctor_data["authentication"]["raw_secret_values"] == 0 and doctor_data["target"]["mutations"] == 0)
        recover = run([PYTHON, "scripts/onboarding-o3.py", "recover", "--json"], env=env)
        recover_data = json.loads(recover.stdout)
        check("recovery leaves runtimes and targets untouched", recover_data["owned_paths_only"] and recover_data["target_project_changes"] == 0 and recover_data["runtime_changes"] == 0)

    cli_help = run([str(ROOT / "aiw"), "help"])
    check("CLI exposes O3 onboarding commands", all(token in cli_help.stdout for token in ["onboarding plan", "onboarding apply", "onboarding doctor", "onboarding recover"]))
    cli_plan = run([str(ROOT / "aiw"), "onboarding", "plan", "--lane", "native", "--json"])
    cli_plan_data = json.loads(cli_plan.stdout)
    check("CLI routes O3 plan to structured output", cli_plan_data["mode"] == "plan" and cli_plan_data["mutations"] == 0)

    if failures:
        print(f"BATCH O3 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print(f"BATCH O3 VALIDATION PASSED: {len(checks)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

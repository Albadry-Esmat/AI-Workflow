#!/usr/bin/env python3
"""Validate Onboarding O2 safety and behavior controls."""
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

    state_schema = load(ROOT / "config/onboarding-o2-state-schema.json")
    policy_schema = load(ROOT / "config/onboarding-o2-policy-schema.json")
    policy = load(ROOT / "config/onboarding-o2-policy.json")
    contract = load(ROOT / "config/onboarding-o2-contract.json")
    catalog = load(ROOT / "config/agent-runtime-catalog.json")
    fixtures = load(ROOT / "evals/onboarding-o2/fixtures.json")

    check("state schema is valid JSON Schema", not schema_errors(state_schema, {"type": "object"}))
    check("policy schema is valid JSON Schema", not schema_errors(policy_schema, {"type": "object"}))
    check("policy validates", not schema_errors(policy, policy_schema))
    check("state policy path is O2-owned", policy["state"]["path"] == ".aiw/onboarding-o2/state.json")
    check("state is resumable and redacted", policy["state"]["resume_allowed"] and policy["state"]["redact_secrets"])
    check("selection is deterministic and no-fallback", policy["selection"]["auto_precedence"] and policy["selection"]["silent_fallback"] is False)
    check("auth is delegated and raw-secret-free", policy["authentication"]["aiw_stores_raw_secrets"] is False and policy["authentication"]["delegated_status_only"])
    check("demo is deterministic zero-write", policy["demo"]["external_writes"] == 0 and policy["demo"]["no_secret"])
    check("recovery is owned-path-only", policy["recovery"]["rollback_only_owned_paths"] and policy["recovery"]["target_projects_untouched"])
    check("contract has all O2 commands", {"setup", "doctor", "agent_list", "agent_detect", "agent_use", "demo", "auth_status", "recover"}.issubset(contract["commands"]))
    check("contract keeps login and launch deferred", contract["commands"]["auth_login"]["status"] == "deferred-runtime-owned" and contract["commands"]["start"]["status"] == "deferred-launch-adapter")
    check("catalog has the nine CLI-matrix adapters", {a["id"] for a in catalog["adapters"]} == {"opencode", "claude-code", "codex", "copilot-cli", "antigravity", "cursor", "gemini-cli", "aider", "generic-command"})
    check("fixtures cover required O2 scenarios", {f["id"] for f in fixtures["fixtures"]} >= {"setup-resume-after-failure", "explicit-missing-fails", "auto-deterministic", "no-runtime-demo", "auth-delegated", "recover-owned-state"})

    with tempfile.TemporaryDirectory(prefix="aiw-o2-controls-") as raw:
        state_root = Path(raw) / "state"
        env = {"AIW_O2_STATE_ROOT": str(state_root)}
        check("check-only setup is no-write/no-network", run([PYTHON, "scripts/onboarding-o2.py", "setup", "--check-only", "--json"], env=env).returncode == 0 and not state_root.exists())
        detection = run([PYTHON, "scripts/onboarding-o2.py", "agent-detect", "--json"], env=env)
        detection_data = json.loads(detection.stdout)
        check("safe detection reports zero writes and secrets", detection_data["external_writes"] == 0 and detection_data["secrets_seen"] is False)
        missing = run([PYTHON, "scripts/onboarding-o2.py", "agent-use", "opencode", "--json"], env=env, expect=1)
        missing_data = json.loads(missing.stdout)
        check("explicit missing adapter fails closed", missing_data["verdict"] == "fail" and missing_data["fallback"] is False)
        auto = run([PYTHON, "scripts/onboarding-o2.py", "agent-use", "auto", "--json"], env=env, expect=1)
        auto_data = json.loads(auto.stdout)
        check("auto selection fails closed when no adapter is present", auto_data["verdict"] == "fail" and auto_data["fallback"] is False)
        demo = run([PYTHON, "scripts/onboarding-o2.py", "demo", "--json"], env=env)
        demo_data = json.loads(demo.stdout)
        check("no-secret demo passes with zero writes", demo_data["verdict"] == "pass" and demo_data["external_writes"] == 0 and demo_data["secrets_seen"] is False)
        auth = run([PYTHON, "scripts/onboarding-o2.py", "auth-status", "--json"], env=env)
        auth_data = json.loads(auth.stdout)
        check("auth status is delegated and redacted", auth_data["raw_secret_values"] == 0 and auth_data["login_started"] is False)
        recover = run([PYTHON, "scripts/onboarding-o2.py", "recover", "--json"], env=env)
        recover_data = json.loads(recover.stdout)
        check("recovery does not touch target or runtimes", recover_data["target_project_changes"] == 0 and recover_data["runtime_changes"] == 0)

    cli_help = run([str(ROOT / "aiw"), "help"])
    check("CLI exposes O2 commands", all(token in cli_help.stdout for token in ["validate-onboarding-o2", "agent detect", "agent use", "auth status", "recover"]))
    check("CLI doctor is structured O2 command", run([str(ROOT / "aiw"), "doctor", "--json"]).stdout.strip().startswith("{"))

    if failures:
        print(f"BATCH O2 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print(f"BATCH O2 VALIDATION PASSED: {len(checks)} checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

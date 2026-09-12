#!/usr/bin/env python3
"""Validate Onboarding Batch O1 deterministic toolchain controls."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ADAPTERS = {"opencode", "claude-code", "codex", "generic-command"}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(instance: Any, schema: Any) -> list[str]:
    validator = Draft7Validator(schema, format_checker=FormatChecker())
    return [e.message for e in sorted(validator.iter_errors(instance), key=lambda e: list(e.path))]


def check(condition: bool, label: str, failures: list[str]) -> None:
    if condition:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label}")
        failures.append(label)


def main() -> int:
    failures: list[str] = []
    paths = {
        "manifest_schema": ROOT / "config/toolchain-manifest-schema.json",
        "manifest": ROOT / "config/toolchain-manifest.json",
        "policy_schema": ROOT / "config/toolchain-policy-schema.json",
        "policy": ROOT / "config/toolchain-policy.json",
        "fixtures": ROOT / "evals/onboarding-o1/fixtures.json",
        "requirements": ROOT / "requirements-dev.txt",
        "package": ROOT / "package.json",
        "lockfile": ROOT / "package-lock.json",
        "checker": ROOT / "scripts/check-toolchain.py",
    }
    for label, path in paths.items():
        check(path.is_file(), f"{label} exists", failures)
    if failures:
        return 1

    manifest_schema = load(paths["manifest_schema"])
    manifest = load(paths["manifest"])
    policy_schema = load(paths["policy_schema"])
    policy = load(paths["policy"])
    fixtures = load(paths["fixtures"])
    package = load(paths["package"])
    lockfile = load(paths["lockfile"])

    errors = validate(manifest, manifest_schema)
    check(not errors, "toolchain manifest validates", failures)
    for error in errors[:5]:
        print(f"  detail: {error}")
    errors = validate(policy, policy_schema)
    check(not errors, "toolchain policy validates", failures)
    for error in errors[:5]:
        print(f"  detail: {error}")

    check({t["id"] for t in manifest["core_tools"]} == {"git", "python", "node", "npm"}, "manifest defines all required core tools", failures)
    check({a["adapter_id"] for a in manifest["adapters"]} == EXPECTED_ADAPTERS, "manifest covers all O0 adapters", failures)
    check(manifest["verification"]["check_only_network"] == "disabled", "check-only verification disables network resolution", failures)
    check(manifest["verification"]["check_only_mutates"] is False, "check-only verification is non-mutating", failures)
    check(manifest["verification"]["unknown_versions_fail_closed"] is True, "unknown versions fail closed", failures)
    check(policy["core_dependencies"]["global_python_install_forbidden"] is True, "global Python installation is forbidden", failures)
    check(policy["core_dependencies"]["global_node_install_forbidden"] is True, "global Node installation is forbidden", failures)
    check(policy["runtime_installation"]["aiw_installs_by_default"] is False, "AI-Workflow does not install agent runtimes by default", failures)
    check(policy["runtime_installation"]["adapter_owned"] is True, "runtime installation remains adapter-owned", failures)
    check(policy["recovery"]["venv_recreatable"] and policy["recovery"]["node_modules_recreatable"], "local dependency environments are recreatable", failures)

    req_lines = [line.strip() for line in paths["requirements"].read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]
    check(req_lines and all("==" in line for line in req_lines), "Python requirements are exact-pinned", failures)
    check(package.get("devDependencies", {}).get("ajv") == "^8.20.0", "package.json declares pinned AJV library", failures)
    check(package.get("devDependencies", {}).get("ajv-formats") == "^3.0.1", "package.json declares pinned AJV formats", failures)
    packages = lockfile.get("packages", {})
    check(lockfile.get("lockfileVersion") == 3, "package-lock uses lockfileVersion 3", failures)
    check("node_modules/ajv" in packages and "node_modules/ajv-formats" in packages, "package-lock contains AJV library entries", failures)

    setup_text = (ROOT / "scripts/setup.sh").read_text(encoding="utf-8")
    health_text = (ROOT / "scripts/health-check.sh").read_text(encoding="utf-8")
    validate_text = (ROOT / "scripts/validate-skills.sh").read_text(encoding="utf-8")
    check("sudo pip3 install" not in setup_text and "pip3 install" not in setup_text, "setup has no system-global pip mutation", failures)
    check("npm install -g" not in setup_text, "setup has no system-global npm mutation", failures)
    check("npm ci --ignore-scripts" in setup_text, "setup uses deterministic root npm ci", failures)
    check("python3 -m venv" in setup_text, "setup creates a project-local Python environment", failures)
    check("_fail \"opencode not found" not in health_text, "health does not require OpenCode", failures)
    check("scripts/validate-json-schema.mjs" in health_text and "npm install -g" not in health_text, "health resolves project-owned schema validation", failures)
    check("scripts/validate-json-schema.mjs" in validate_text and "npm install -g" not in validate_text, "skill validation resolves project-owned schema validation", failures)

    fixture_ids = {f["id"] for f in fixtures["fixtures"]}
    required = {
        "manifest-validates", "check-only-no-network", "python-global-mutation-blocks",
        "node-global-mutation-blocks", "lockfile-drift-blocks", "unknown-core-version-blocks",
        "runtime-install-requires-consent", "local-environments-recreate",
    }
    check(fixture_ids == required, "O1 fixtures cover deterministic and safety scenarios", failures)

    if not failures:
        try:
            result = subprocess.run(
                [sys.executable, str(paths["checker"]), "--check-only", "--no-network"],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            print(result.stdout.rstrip())
            if result.stderr:
                print(result.stderr.rstrip(), file=sys.stderr)
            check(result.returncode == 0, "check-toolchain passes in check-only/no-network mode", failures)
        except OSError as exc:
            check(False, f"check-toolchain execution ({exc})", failures)

    print()
    if failures:
        print(f"BATCH O1 VALIDATION FAILED: {len(failures)} failure(s)")
        return 1
    print("BATCH O1 VALIDATION PASSED: deterministic toolchain controls passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

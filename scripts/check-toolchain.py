#!/usr/bin/env python3
"""Check the deterministic O1 toolchain without installing or using the network."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def probe(executable: str, args: list[str]) -> tuple[bool, str]:
    path = shutil.which(executable)
    if not path:
        return False, f"{executable}: not found"
    try:
        result = subprocess.run([path, *args], capture_output=True, text=True, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"{executable}: probe failed ({exc})"
    output = (result.stdout or result.stderr).strip().splitlines()
    value = output[0] if output else ""
    return result.returncode == 0, f"{executable}: {value or 'no version output'}"


def version_tuple(text: str) -> tuple[int, int, int] | None:
    match = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", text)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3) or 0)


def satisfies(version: tuple[int, int, int] | None, selector: str) -> bool:
    if version is None:
        return False
    for clause in selector.split(","):
        clause = clause.strip()
        match = re.match(r"(>=|<=|>|<|==)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?", clause)
        if not match:
            return False
        op = match.group(1) or "=="
        target = (int(match.group(2)), int(match.group(3) or 0), int(match.group(4) or 0))
        if op == ">=" and not version >= target:
            return False
        if op == "<=" and not version <= target:
            return False
        if op == ">" and not version > target:
            return False
        if op == "<" and not version < target:
            return False
        if op == "==" and not version == target:
            return False
    return True


def check(root: Path, no_network: bool) -> tuple[list[dict[str, str]], list[str]]:
    manifest = load(root / "config/toolchain-manifest.json")
    policy = load(root / "config/toolchain-policy.json")
    results: list[dict[str, str]] = []
    failures: list[str] = []

    def record(label: str, ok: bool, detail: str) -> None:
        results.append({"label": label, "status": "pass" if ok else "fail", "detail": detail})
        if not ok:
            failures.append(label)
        print(f"{'PASS' if ok else 'FAIL'}: {label} — {detail}")

    record("no-network mode", no_network, "network resolution is disabled for check-only verification" if no_network else "run with --no-network for the O1 gate")
    record("check-only non-mutation policy", policy["verification"]["check_only_is_non_mutating"], "policy requires no mutation")
    record("global Python installation forbidden", policy["core_dependencies"]["global_python_install_forbidden"], "use .venv")
    record("global Node installation forbidden", policy["core_dependencies"]["global_node_install_forbidden"], "use package-lock.json and local node_modules")

    for tool in manifest["core_tools"]:
        ok, detail = probe(tool["executable"], tool["version_args"])
        parsed = version_tuple(detail)
        in_range = ok and satisfies(parsed, tool["supported_range"])
        record(f"core tool {tool['id']}", in_range, f"{detail}; supported {tool['supported_range']}")

    venv_python = root / manifest["python"]["venv_dir"] / "bin/python"
    record("project-local Python environment", venv_python.is_file(), str(venv_python))
    requirements = root / manifest["python"]["requirements_file"]
    req_lines = [line.strip() for line in requirements.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")] if requirements.is_file() else []
    record("pinned Python requirements", bool(req_lines) and all("==" in line for line in req_lines), str(requirements))

    package_json_path = root / manifest["node"]["package_json"]
    lockfile_path = root / manifest["node"]["lockfile"]
    package_json = load(package_json_path) if package_json_path.is_file() else {}
    lockfile = load(lockfile_path) if lockfile_path.is_file() else {}
    dev_dependencies = package_json.get("devDependencies", {})
    local_ajv = root / "node_modules/.bin/ajv"
    lock_packages = lockfile.get("packages", {})
    lock_root = lock_packages.get("", {})
    record("Node package-lock exists", lockfile_path.is_file(), str(lockfile_path))
    record("Node lockfile v3", lockfile.get("lockfileVersion") == 3, str(lockfile.get("lockfileVersion")))
    record("AJV dependencies are pinned in package.json", dev_dependencies.get("ajv-cli") == "^5.0.0" and dev_dependencies.get("ajv-formats") == "^3.0.1", "ajv-cli and ajv-formats")
    record("AJV dependencies are present in lockfile", "node_modules/ajv-cli" in lock_packages and "node_modules/ajv-formats" in lock_packages, "package-lock dependency tree")
    record("AJV executable is project-local", local_ajv.is_file(), str(local_ajv))
    record("root package lock has no unexpected package manager override", not lock_root.get("packageManager", "").startswith("global"), "local lockfile")

    setup_text = (root / "scripts/setup.sh").read_text(encoding="utf-8")
    health_text = (root / "scripts/health-check.sh").read_text(encoding="utf-8")
    record("setup has no global pip install", "sudo pip3 install" not in setup_text and "pip3 install" not in setup_text, "system Python is not mutated")
    record("setup has no global npm install", "npm install -g" not in setup_text, "system Node global packages are not mutated")
    record("health does not require a named runtime", "_fail \"opencode not found" not in health_text, "runtime absence is non-fatal in O1")
    record("runtime installation remains adapter-owned", policy["runtime_installation"]["adapter_owned"], "O2 will implement guided runtime behavior")

    return results, failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--check-only", action="store_true", help="assert that this invocation is non-mutating")
    parser.add_argument("--no-network", action="store_true", help="disable all network resolution; required for the O1 gate")
    parser.add_argument("--json-output", type=Path, help="optional evidence output path")
    args = parser.parse_args()
    root = args.root.resolve()
    results, failures = check(root, no_network=args.no_network)
    payload = {"schema_version": "1.0.0", "mode": "check-only" if args.check_only else "check", "network": "disabled" if args.no_network else "unspecified", "results": results, "failures": failures, "verdict": "pass" if args.check_only and args.no_network and not failures else "fail"}
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"O1 TOOLCHAIN VERDICT: {payload['verdict'].upper()}")
    return 0 if payload["verdict"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())

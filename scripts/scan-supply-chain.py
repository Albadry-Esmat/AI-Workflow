"""Run offline-safe supply-chain checks for lockfiles, SBOM inputs, and CI action pins."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PIN_RE = re.compile(r"uses:\s*[^\s#]+@([0-9a-f]{40})")
LATEST_RE = re.compile(r"uses:\s*[^\s#]+@(latest|master|main|v\d+)$")


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def check_lock(repository: str, manifest_path: Path, lockfile_path: Path) -> list[str]:
    failures: list[str] = []
    if not manifest_path.exists():
        return [f"{repository}: missing manifest {manifest_path}"]
    if not lockfile_path.exists():
        return [f"{repository}: missing required lockfile {lockfile_path}"]
    manifest = load(manifest_path)
    lock = load(lockfile_path)
    if lock.get("lockfileVersion", 0) < 2:
        failures.append(f"{repository}: lockfileVersion must be >= 2")
    packages = lock.get("packages")
    if not isinstance(packages, dict):
        failures.append(f"{repository}: packages object missing")
        return failures
    root = packages.get("", {})
    declared = {}
    declared.update(manifest.get("dependencies", {}))
    declared.update(manifest.get("devDependencies", {}))
    for name in declared:
        node_path = f"node_modules/{name}"
        entry = packages.get(node_path)
        if not entry or not entry.get("version"):
            failures.append(f"{repository}: direct dependency {name} missing a locked version")
    for path, entry in packages.items():
        if path and path.startswith("node_modules/") and not entry.get("version"):
            failures.append(f"{repository}: {path} has no locked version")
    if root.get("name") and root["name"] != manifest.get("name"):
        failures.append(f"{repository}: manifest and lock root names differ")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--website-root", type=Path, help="Optionally include a local website checkout")
    parser.add_argument("--workflow", type=Path, default=Path(".github/workflows"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/dependency-scan.json"))
    args = parser.parse_args()
    source = args.source_root.resolve()
    failures = []
    failures.extend(check_lock("AI-Workflow", source / "package.json", source / "package-lock.json"))
    lockfiles_checked = [str(source / "package-lock.json")]
    if args.website_root:
        website = args.website_root.resolve()
        failures.extend(check_lock("ASE-OS-Website", website / "package.json", website / "package-lock.json"))
        lockfiles_checked.append(str(website / "package-lock.json"))
    workflow = (source / args.workflow).resolve() if not args.workflow.is_absolute() else args.workflow.resolve()
    if not workflow.exists():
        failures.append(f"missing workflow path: {workflow}")
    else:
        workflow_paths = [workflow] if workflow.is_file() else sorted(workflow.glob("*.yml"))
        if not workflow_paths:
            failures.append(f"no workflow files found under: {workflow}")
        for workflow_path in workflow_paths:
            text = workflow_path.read_text()
            uses_lines = [line.strip() for line in text.splitlines() if "uses:" in line]
            for line in uses_lines:
                if not PIN_RE.search(line):
                    failures.append(f"{workflow_path.name}: CI action is not immutable-pinned: {line}")
                if LATEST_RE.search(line):
                    failures.append(f"{workflow_path.name}: CI action uses a forbidden moving tag: {line}")
    result = {
        "schema_version": "1.0.0",
        "advisory_source": "offline-lock-integrity",
        "advisory_database_available": False,
        "lockfiles_checked": lockfiles_checked,
        "findings": [{"severity": "high", "code": failure} for failure in failures],
        "verdict": "block" if failures else "pass",
        "limitations": ["No online vulnerability advisory database was consulted; npm audit/OSV must run in an environment with advisory access."]
    }
    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.output.resolve().write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    if failures:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

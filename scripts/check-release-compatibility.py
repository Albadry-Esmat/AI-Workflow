"""Check AI-Workflow Dev to ASE-OS-Website Dev release compatibility."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "config" / "release-compatibility-schema.json"


def git_value(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def data_hash(source_root: Path) -> str:
    digest = subprocess.check_output(["python3", str(source_root / "scripts" / "data-integrity.py"), "hash", str(source_root / "website" / "data")], text=True).strip()
    return digest if digest.startswith("sha256:") else f"sha256:{digest}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-website-validation", action="store_true")
    parser.add_argument("--require-website-build", action="store_true")
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    manifest = json.loads(args.manifest.resolve().read_text())
    source_commit = git_value(source_root, "rev-parse", "HEAD")
    source_branch = git_value(source_root, "branch", "--show-current")
    current_hash = data_hash(source_root)
    violations: list[str] = []
    checks = []

    if source_branch != "Dev":
        violations.append(f"source branch is {source_branch}, expected Dev")
    checks.append("source branch is Dev")
    if manifest.get("source_branch") != "Dev":
        violations.append("manifest source_branch is not Dev")
    checks.append("manifest source branch is Dev")
    if manifest.get("website_branch") != "Dev":
        violations.append("manifest website_branch is not Dev")
    checks.append("manifest website branch is Dev")
    if manifest.get("source_commit") != source_commit:
        violations.append("manifest source_commit does not equal current source HEAD")
    checks.append("source commit matches manifest")
    if manifest.get("data_hash") != current_hash:
        violations.append("manifest data_hash does not equal current website/data hash")
    checks.append("website data hash matches manifest")
    if manifest.get("source_validation") != "pass":
        violations.append("manifest source_validation is not pass")
    checks.append("source validation passed")
    if args.require_website_validation and manifest.get("website_validation") != "pass":
        violations.append("website validation is required but manifest is not pass")
    if args.require_website_build and manifest.get("website_build") != "pass":
        violations.append("website build is required but manifest is not pass")

    result = {
        "schema_version": "1.0.0",
        "source_branch": source_branch,
        "website_branch": manifest.get("website_branch", ""),
        "source_commit": source_commit,
        "manifest_source_commit": manifest.get("source_commit", ""),
        "data_hash": current_hash,
        "manifest_data_hash": manifest.get("data_hash", ""),
        "source_validation": manifest.get("source_validation", "fail"),
        "website_validation": manifest.get("website_validation", "not-run"),
        "website_build": manifest.get("website_build", "not-run"),
        "compatibility_checks": checks,
        "verdict": "compatible" if not violations else "block",
        "violations": violations,
        "checked_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    schema = json.loads(SCHEMA.read_text())
    schema_errors = list(Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(result))
    if schema_errors:
        violations.extend(f"result schema: {error.message}" for error in schema_errors)
        result["verdict"] = "block"
    if args.output:
        args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
        args.output.resolve().write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    if violations:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

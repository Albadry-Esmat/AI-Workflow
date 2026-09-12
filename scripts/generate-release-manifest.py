#!/usr/bin/env python3
"""Generate and validate an AI-Workflow to website Dev ReleaseManifest."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
HASH_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


def git_value(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def registry_version(source_root: Path) -> str:
    with (source_root / "skills" / "registry.json").open() as handle:
        data = json.load(handle)
    return str(data["version"])


def validate(manifest: dict) -> list[str]:
    errors = []
    required = {
        "manifest_version", "source_repository", "source_branch", "source_commit",
        "website_repository", "website_branch", "website_commit", "website_commit_role", "data_hash",
        "registry_version", "source_validation", "website_validation", "generated_at",
    }
    errors.extend(f"missing field: {field}" for field in sorted(required - set(manifest)))
    if manifest.get("manifest_version") != "1.0.0":
        errors.append("manifest_version must be 1.0.0")
    if manifest.get("source_branch") != "Dev":
        errors.append("source_branch must be Dev")
    if manifest.get("website_branch") != "Dev":
        errors.append("website_branch must be Dev")
    if not COMMIT_RE.match(str(manifest.get("source_commit", ""))):
        errors.append("source_commit must be a 40-character lowercase SHA")
    if not COMMIT_RE.match(str(manifest.get("website_commit", ""))):
        errors.append("website_commit must be a 40-character lowercase SHA")
    if manifest.get("website_commit_role") != "sync-base":
        errors.append("website_commit_role must be sync-base")
    if not HASH_RE.match(str(manifest.get("data_hash", ""))):
        errors.append("data_hash must be sha256:<64 lowercase hex characters>")
    if manifest.get("source_validation") not in {"pass", "fail"}:
        errors.append("source_validation must be pass or fail")
    if manifest.get("website_validation") not in {"pass", "fail", "not-run"}:
        errors.append("website_validation must be pass, fail, or not-run")
    if manifest.get("website_build") not in {"pass", "fail", "not-run", None}:
        errors.append("website_build must be pass, fail, or not-run")
    try:
        dt.datetime.fromisoformat(str(manifest.get("generated_at", "")).replace("Z", "+00:00"))
    except ValueError:
        errors.append("generated_at must be an ISO-8601 date-time")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--website-root", type=Path, required=True)
    parser.add_argument("--data-hash", required=True)
    parser.add_argument("--source-validation", choices=["pass", "fail"], default="pass")
    parser.add_argument("--website-validation", choices=["pass", "fail", "not-run"], default="not-run")
    parser.add_argument("--website-build", choices=["pass", "fail", "not-run"], default="not-run")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    website_root = args.website_root.resolve()
    source_commit = git_value(source_root, "rev-parse", "HEAD")
    website_commit = git_value(website_root, "rev-parse", "HEAD")
    manifest = {
        "manifest_version": "1.0.0",
        "source_repository": "Albadry-Esmat/AI-Workflow",
        "source_branch": git_value(source_root, "branch", "--show-current"),
        "source_commit": source_commit,
        "website_repository": "Albadry-Esmat/ASE-OS-Website",
        "website_branch": git_value(website_root, "branch", "--show-current"),
        "website_commit": website_commit,
        "website_commit_role": "sync-base",
        "data_hash": args.data_hash if args.data_hash.startswith("sha256:") else f"sha256:{args.data_hash}",
        "registry_version": registry_version(source_root),
        "source_validation": args.source_validation,
        "website_validation": args.website_validation,
        "website_build": args.website_build,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "trigger": "AI-Workflow Dev synchronization",
    }
    errors = validate(manifest)
    if args.validate or errors:
        if errors:
            for error in errors:
                print(f"FAIL: {error}", file=sys.stderr)
            return 1
        print("PASS: ReleaseManifest schema-level validation")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

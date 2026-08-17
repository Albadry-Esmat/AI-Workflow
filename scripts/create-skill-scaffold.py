#!/usr/bin/env python3
"""Create a reviewable, non-registered Batch 9 skill scaffold."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft7Validator, RefResolver

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "config" / "skill-sdk-policy.json"
SECTIONS = [
    "Purpose",
    "Inputs",
    "Required Context",
    "Execution Logic",
    "Outputs",
    "Rules",
    "Security",
    "Token Optim",
    "Quality Check",
    "Failure",
    "Human-in-the-Loop",
    "Skill Composition",
]


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"^-+|-+$", "", value)
    return value


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_policy() -> dict:
    policy = json.loads(POLICY_PATH.read_text())
    scaffold = policy["scaffold"]
    if scaffold["auto_register"] or scaffold["auto_promote"]:
        raise SystemExit("Refusing to run: scaffold policy must keep auto_register and auto_promote false")
    if scaffold["required_sections"] != SECTIONS:
        raise SystemExit("Refusing to run: scaffold section policy does not match the generator contract")
    return policy


def build_skill_md(name: str, version: str, domain: str, description: str, author: str) -> str:
    lines = [
        "---",
        f"name: {name}",
        f"version: {version}",
        f"domain: {domain}",
        f"description: {description}",
        f"author: {author}",
        "status: draft",
        "---",
        "",
        f"# {name}",
        "",
    ]
    bodies = {
        "Purpose": f"Define the single responsibility of `{name}` and the user problem it addresses.",
        "Inputs": "Declare the structured inputs required by this skill and their expected types.",
        "Required Context": "List the prior artifacts, approvals, policies, and repository context required before execution.",
        "Execution Logic": "Describe deterministic steps, decision points, and bounded retries. Replace this scaffold text before registration.",
        "Outputs": "Declare the structured outputs, artifact references, and schema versions produced by this skill.",
        "Rules": "State positive rules, anti-patterns, scope boundaries, and when to stop.",
        "Security": "State data sensitivity, allowed capabilities, redaction requirements, and fail-closed behavior.",
        "Token Optim": "Describe context minimization, compression, and output-size limits.",
        "Quality Check": "Define contract checks, semantic evaluation, and acceptance thresholds.",
        "Failure": "Classify failures, retryable conditions, terminal conditions, and recovery evidence.",
        "Human-in-the-Loop": "Declare approvals required for high-risk actions, promotion, external writes, or policy changes.",
        "Skill Composition": "Declare dependencies, consumers, produced artifacts, and composition edges, or state that none exist.",
    }
    for section in SECTIONS:
        lines.extend([f"## {section}", bodies[section], ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="lowercase hyphenated skill name")
    parser.add_argument("--domain", required=True, help="catalog domain")
    parser.add_argument("--description", required=True, help="single-responsibility description")
    parser.add_argument("--version", default="0.1.0")
    parser.add_argument("--author", default="skill-author")
    parser.add_argument("--team", default="unassigned")
    parser.add_argument("--maintainer", default="unassigned")
    parser.add_argument("--security-class", choices=["low", "medium", "high", "critical"], default="low")
    parser.add_argument("--layer", choices=["pipeline-entry", "pipeline-core", "pipeline-quality", "pipeline-release", "pipeline-support", "utility", "meta"], default="pipeline-support")
    parser.add_argument("--mastery-level", choices=["beginner", "intermediate", "advanced"], default="beginner")
    parser.add_argument("--budget-profile", default="skill-draft-v1")
    parser.add_argument("--output-root", default=None, help="override the policy draft output root")
    parser.add_argument("--force", action="store_true", help="replace an existing draft directory")
    args = parser.parse_args()

    policy = load_policy()
    name = slugify(args.name)
    if not name or name != args.name:
        raise SystemExit("--name must already be lowercase hyphenated slug text")
    if not re.fullmatch(r"\d+\.\d+\.\d+", args.version):
        raise SystemExit("--version must be semantic version text")
    if not re.fullmatch(r"[a-z0-9-]+", args.domain):
        raise SystemExit("--domain must be lowercase hyphenated text")

    output_root = ROOT / (args.output_root or policy["scaffold"]["output_root"])
    destination = output_root / name
    if destination.exists():
        if not args.force:
            raise SystemExit(f"Refusing to overwrite existing scaffold: {destination}")
        for child in sorted(destination.rglob("*"), reverse=True):
            if child.is_file() or child.is_symlink():
                child.unlink()
            elif child.is_dir():
                child.rmdir()
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "contract-tests").mkdir()
    (destination / "eval-fixtures").mkdir()
    created_at = utc_now()
    manifest = {
        "schema_version": "1.0.0",
        "kind": "skill-scaffold",
        "name": name,
        "version": args.version,
        "domain": args.domain,
        "layer": args.layer,
        "mastery_level": args.mastery_level,
        "description": args.description,
        "status": "draft",
        "created_at": created_at,
        "source": "aiw-skill-create",
        "registration": {"auto_register": False, "auto_promote": False, "requires_explicit_apply": True},
        "metadata": {
            "ownership": {"team": args.team, "maintainer": args.maintainer, "reviewers": [args.maintainer], "last_reviewed_at": created_at},
            "maturity": "experimental",
            "eval_score": None,
            "security_class": args.security_class,
            "cost": {"budget_profile": args.budget_profile, "estimated_tokens": None, "estimated_usd": None},
            "deprecation": {"deprecated": False, "replacement": None, "message": None, "sunset_at": None, "approved_by": None},
        },
        "required_sections": SECTIONS,
        "files": list(policy["scaffold"]["required_files"]),
    }
    contract = {
        "schema_version": "1.0.0",
        "skill_name": name,
        "contract_status": "draft",
        "inputs": [{"name": "context", "type": "object", "required": True}],
        "outputs": [{"name": "result", "type": "object", "required": True}],
        "external_writes_allowed": False,
        "placeholder": True,
    }
    eval_index = {
        "schema_version": "1.0.0",
        "skill_name": name,
        "suite_status": "draft",
        "cases": [{"case_id": f"{name}-smoke-001", "kind": "golden", "fixture": "fixture-placeholder", "status": "draft", "approval_status": "pending"}],
        "minimum_cases_before_registration": 1,
    }
    schema = json.loads((ROOT / "config/skill-scaffold-schema.json").read_text())
    metadata_schema = json.loads((ROOT / "config/skill-metadata-schema.json").read_text())
    resolver = RefResolver.from_schema(schema, store={
        metadata_schema["$id"]: metadata_schema,
        "https://ase-os/schemas/skill-metadata-schema.json": metadata_schema,
        "skill-metadata-schema.json": metadata_schema,
    })
    errors = sorted(Draft7Validator(schema, resolver=resolver).iter_errors(manifest), key=lambda error: list(error.path))
    if errors:
        raise SystemExit("Generated scaffold manifest failed schema: " + "; ".join(error.message for error in errors))
    (destination / "SKILL.md").write_text(build_skill_md(name, args.version, args.domain, args.description, args.author))
    (destination / "skill-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (destination / "contract-tests" / "contract.json").write_text(json.dumps(contract, indent=2) + "\n")
    (destination / "eval-fixtures" / "index.json").write_text(json.dumps(eval_index, indent=2) + "\n")
    scaffold_display = str(destination.relative_to(ROOT)) if destination.is_relative_to(ROOT) else str(destination)
    print(json.dumps({"verdict": "pass", "registered": False, "promoted": False, "scaffold": scaffold_display, "files": manifest["files"]}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

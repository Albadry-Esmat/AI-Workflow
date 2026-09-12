#!/usr/bin/env python3
"""Apply an approved skill scaffold to the canonical catalog with rollback safety."""
from __future__ import annotations

import argparse
import copy
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def bump_minor(version: str) -> str:
    major, minor, _patch = (int(x) for x in version.split("."))
    return f"{major}.{minor + 1}.0"


def parse_next_id(index_text: str) -> str:
    ids = [int(x) for x in re.findall(r"^- id: SKL-(\d+)", index_text, flags=re.MULTILINE)]
    return f"SKL-{max(ids, default=0) + 1:03d}"


def yaml_quote(value: str) -> str:
    if re.fullmatch(r"[a-z0-9_.-]+", value):
        return value
    return "'" + value.replace("'", "''") + "'"


def index_block(skill_id: str, manifest: dict) -> str:
    name = manifest["name"]
    description = manifest["description"].replace("\n", " ").strip()
    version = manifest["version"]
    domain = manifest["domain"]
    mastery = manifest["mastery_level"]
    return "\n".join([
        f"- id: {skill_id}",
        f"  name: {name}",
        f"  short_description: {description}",
        f"  reference_path: .opencode/skills/{name}/SKILL.md",
        "  reference_sections:",
        *[f"  - '## {section}'" for section in manifest["required_sections"]],
        f"  executable_skill: .opencode/skills/{name}/SKILL.md",
        "  tags:",
        "  - batch9",
        "  - scaffolded",
        f"  version: {version}",
        "  depends_on: []",
        f"  mastery_level: {mastery}",
        f"  use_when: {yaml_quote(description)}",
        "  do_not_use_when: 'Use only after the scaffold has been completed, evaluated, and explicitly approved.'",
        "",
    ])


def graph_node(skill_id: str, manifest: dict) -> str:
    return "\n".join([
        f"- id: {skill_id}",
        f"  name: {manifest['name']}",
        f"  domain: {manifest['domain']}",
        f"  mastery_level: {manifest['mastery_level']}",
        f"  version: {manifest['version']}",
        "  status: experimental",
        f"  layer: {manifest['layer']}",
        "",
    ])


def ensure_scaffold(scaffold: Path) -> tuple[dict, list[str]]:
    manifest_path = scaffold / "skill-manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Missing scaffold manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text())
    required = ["SKILL.md", "skill-manifest.json", "contract-tests/contract.json", "eval-fixtures/index.json"]
    missing = [p for p in required if not (scaffold / p).is_file()]
    if missing:
        raise SystemExit(f"Scaffold is incomplete; missing: {', '.join(missing)}")
    if manifest.get("status") != "draft" or manifest.get("registration", {}).get("auto_register"):
        raise SystemExit("Only non-registered draft scaffolds can be applied")
    return manifest, required


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scaffold", required=True, help="path to an aiw skill create scaffold")
    parser.add_argument("--apply", action="store_true", help="perform the explicit catalog mutation")
    parser.add_argument("--approved-by", default="", help="human approver; required with --apply")
    parser.add_argument("--root", default=str(ROOT), help="AI-Workflow root; useful for isolated validation fixtures")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    scaffold = Path(args.scaffold).resolve()
    if not scaffold.is_dir():
        raise SystemExit(f"Scaffold directory not found: {scaffold}")
    manifest, required_files = ensure_scaffold(scaffold)
    name = manifest["name"]
    index_path = root / "skills/index.yaml"
    registry_path = root / "skills/registry.json"
    graph_path = root / "skills/graph/skill-graph.yaml"
    skill_destination = root / ".opencode/skills" / name
    index_text = index_path.read_text()
    registry = json.loads(registry_path.read_text())
    graph_text = graph_path.read_text()
    if re.search(rf"^- id: SKL-\d+\n  name: {re.escape(name)}$", index_text, flags=re.MULTILINE):
        raise SystemExit(f"Skill already exists in index: {name}")
    if any(entry.get("name") == name for entry in registry.get("skills", [])):
        raise SystemExit(f"Skill already exists in registry: {name}")
    if skill_destination.exists():
        raise SystemExit(f"Live skill directory already exists: {skill_destination}")

    skill_id = parse_next_id(index_text)
    plan = {
        "verdict": "plan" if not args.apply else "apply",
        "skill_id": skill_id,
        "name": name,
        "scaffold": str(scaffold),
        "target": str(skill_destination),
        "registered": False,
        "promoted": False,
        "requires_approval": True,
        "approved_by": args.approved_by or None,
        "changed_files": [str(skill_destination / f) for f in required_files] + [str(index_path), str(registry_path), str(graph_path)],
    }
    if not args.apply:
        print(json.dumps(plan, indent=2))
        return 0
    if not args.approved_by.strip():
        raise SystemExit("--approved-by is required with --apply; no implicit approval is allowed")

    backup_root = root / "artifacts/skill-apply-backups" / f"{name}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    backup_root.mkdir(parents=True, exist_ok=True)
    backup_files = [index_path, registry_path, graph_path]
    for path in backup_files:
        destination = backup_root / path.relative_to(root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    try:
        shutil.copytree(scaffold, skill_destination, ignore=shutil.ignore_patterns("__pycache__"))
        updated_index = index_text.rstrip() + "\n" + index_block(skill_id, manifest)
        index_path.write_text(updated_index)
        registry = copy.deepcopy(registry)
        registry["version"] = bump_minor(registry.get("version", "0.0.0"))
        metadata = copy.deepcopy(manifest["metadata"])
        metadata["ownership"]["last_reviewed_at"] = manifest["created_at"]
        registry_entry = {
            "name": name,
            "version": manifest["version"],
            "status": "draft",
            "domain": manifest["domain"],
            "path": f".opencode/skills/{name}/SKILL.md",
            "description": manifest["description"],
            "inputs": ["context"],
            "outputs": ["result"],
            "consumes_from": [],
            "produces_for": [],
            "orchestration": "Draft scaffold; not routable until explicit promotion.",
            "feedback_routes": [],
            "origin_metadata": {
                "source": "human",
                "created_by_session": None,
                "approval_tier": "standard",
                "dedup_override": False,
                "dedup_override_reason": None,
                "created_at": manifest["created_at"],
            },
            "skill_metadata": metadata,
        }
        registry["skills"].append(registry_entry)
        registry_path.write_text(json.dumps(registry, indent=2) + "\n")
        node = graph_node(skill_id, manifest)
        if "\nedges:" in graph_text:
            graph_text = graph_text.replace("\nedges:", "\n" + node + "edges:", 1)
        else:
            graph_text = graph_text.rstrip() + "\n\n" + node + "edges:\n"
        graph_text = re.sub(r"(total_nodes:\s*)(\d+)", lambda m: m.group(1) + str(int(m.group(2)) + 1), graph_text, count=1)
        graph_text = re.sub(r"(last_updated:\s*)['\"]?[^'\"\n]+['\"]?", lambda m: m.group(1) + "'" + manifest["created_at"][:10] + "'", graph_text, count=1)
        graph_path.write_text(graph_text)
        subprocess.run(["bash", str(root / "scripts/validate-skills.sh")], cwd=root, check=True)
    except Exception:
        for path in backup_files:
            restored = backup_root / path.relative_to(root)
            shutil.copy2(restored, path)
        if skill_destination.exists():
            shutil.rmtree(skill_destination)
        raise

    plan.update({"verdict": "pass", "registered": True, "backup": str(backup_root.relative_to(root)), "approved_by": args.approved_by})
    print(json.dumps(plan, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

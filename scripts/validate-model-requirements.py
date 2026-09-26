#!/usr/bin/env python3
"""Validate single-source-of-truth model authority and runtime boundary (v2).

Ownership:
  model-requirements.yml = authority (model POLICY: optional per-agent/task
                           explicit overrides + optional global_agent_model;
                           absent/null model = inherit runtime/session model)
  task router            = work path only (pipeline/agent/stage + model_requirement ref)
  opencode.json          = runtime projection (generated representation, never authority)

Precedence: agent/task explicit model → global_agent_model → runtime/session model.
Inheritance (null/absent model) is normal, NOT fallback. Explicit overrides
fail closed with no silent inheritance.

Checks:
  - config/model-requirements.yml exists and validates against its schema
  - every agent/task model is an exact provider/model id OR null/absent (inherit)
  - fallbacks are exact ids, on_unavailable == fail_closed
  - inheriting entries declare no fallbacks
  - global_agent_model is null or an exact id
  - no provider provisioning fields (api_key/login/install/provider_setup)
  - task-router.yaml declares NO execution model IDs; each route references
    the manifest via model_requirement (dependency, not duplication)
  - opencode.json projection matches policy: explicit → exact per-agent model;
    inherit → no per-agent model field; global set → top-level model == global;
    global null → no top-level model field
  - runtime prerequisites declare operator ownership, managed_by_aiw == false
  - installer catalog carries the operator-owned, never-executed boundary marker
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "config/model-requirements.yml"
SCHEMA = ROOT / "config/model-requirements-schema.json"
ROUTER = ROOT / "config/task-router.yaml"
PREREQS = ROOT / "config/runtime-prerequisites.json"
PREREQS_SCHEMA = ROOT / "config/runtime-prerequisites-schema.json"
INSTALLER_CATALOG = ROOT / "config/runtime-installer-catalog.json"

VAGUE = {"cheap", "balanced", "frontier", "haiku-class", "sonnet-class", "opus-class"}
FORBIDDEN_KEYS = {"api_key", "login_command", "install_command", "provider_setup"}


def fail(msg: str, failures: list[str]) -> None:
    failures.append(msg)


def is_exact(model_id: object) -> bool:
    return isinstance(model_id, str) and "/" in model_id and model_id.strip().lower() not in VAGUE


def _frontmatter_model(text: str) -> object:
    """Return the `model:` value inside the leading `---` frontmatter block.

    Returns None when the block exists but carries no model line (inherit),
    and the "__NO_FRONTMATTER__" sentinel when no frontmatter block exists.
    """
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return "__NO_FRONTMATTER__"
    for line in lines[1:]:
        if line.strip() == "---":
            break
        stripped = line.strip()
        if stripped.startswith("model:"):
            return stripped.split(":", 1)[1].strip()
    else:
        return "__NO_FRONTMATTER__"
    return None


def main() -> int:
    failures: list[str] = []
    if not MANIFEST.is_file():
        print("FAIL: config/model-requirements.yml is missing (authoritative manifest required)")
        return 1
    manifest = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    for error in Draft7Validator(schema).iter_errors(manifest):
        fail(f"schema: {list(error.path)}: {error.message}", failures)

    # Global agent model: null (inherit) or exact id.
    global_model = manifest.get("global_agent_model")
    if global_model is not None and not is_exact(global_model):
        fail(f"global_agent_model must be null or an exact provider/model id, got {global_model!r}", failures)
    if isinstance(global_model, str) and global_model.strip().lower() in VAGUE:
        fail("global_agent_model uses vague tier as authority", failures)

    inherit_count = 0
    explicit_count = 0
    for section in ("agents", "tasks"):
        for name, req in (manifest.get(section) or {}).items():
            model = req.get("model")
            if model is None:
                inherit_count += 1
            else:
                explicit_count += 1
                if not is_exact(model):
                    fail(f"{section}.{name}.model must be an exact provider/model id or null (inherit), got {model!r}", failures)
                if str(model).strip().lower() in VAGUE:
                    fail(f"{section}.{name}.model uses vague tier as authority", failures)
            for fb in req.get("fallbacks", []) or []:
                if not is_exact(fb):
                    fail(f"{section}.{name}.fallbacks entry must be exact, got {fb!r}", failures)
            if model is None and (req.get("fallbacks", []) or []):
                fail(f"{section}.{name} inherits (no model) and must not declare fallbacks", failures)
            if req.get("on_unavailable") != "fail_closed":
                fail(f"{section}.{name}.on_unavailable must be fail_closed", failures)
            if FORBIDDEN_KEYS & set(req.keys()):
                fail(f"{section}.{name} must not contain provider provisioning fields", failures)

    # Task router: work path only. Must NOT author execution model IDs.
    # Each route references the manifest (model_requirement: tasks.<name>);
    # the resolver applies precedence (task override → global → runtime).
    router = yaml.safe_load(ROUTER.read_text(encoding="utf-8"))
    for route, entry in (router.get("routes") or {}).items():
        for forbidden in ("model", "model_id"):
            if forbidden in entry:
                fail(f"task-router route '{route}' must not declare '{forbidden}' (single source of truth is the manifest)", failures)
        ref = entry.get("model_requirement") or f"tasks.{route}"
        if not ref.startswith("tasks."):
            fail(f"task-router route '{route}' has invalid model_requirement {ref!r}", failures)
            continue
        target = ref.split(".", 1)[1]
        if target not in (manifest.get("tasks") or {}):
            fail(f"task-router route '{route}' references unknown manifest requirement {ref!r}", failures)
        if "model_tier" in entry:
            fail(f"task-router route '{route}' must not use 'model_tier'; use 'tier_hint' metadata only", failures)

    # opencode.json is a runtime projection of the manifest, never an authority.
    # Explicit entries project an exact per-agent model; inheriting entries
    # project NO per-agent model (native OpenCode inheritance). Global set
    # projects the top-level model; global null projects no top-level model.
    opencode = json.loads((ROOT / "opencode.json").read_text(encoding="utf-8"))
    for name, req in (manifest.get("agents") or {}).items():
        entry = (opencode.get("agent") or {}).get(name)
        if entry is None:
            fail(f"runtime projection: agent '{name}' in manifest but missing in opencode.json", failures)
        elif req.get("model"):
            if entry.get("model") != req.get("model"):
                fail(f"runtime projection drift: agent '{name}' opencode.json {entry.get('model')!r} != manifest {req.get('model')!r} (run sync-opencode-models.js --write)", failures)
        elif "model" in entry:
            fail(f"runtime projection drift: agent '{name}' inherits but opencode.json pins {entry.get('model')!r} (run sync-opencode-models.js --write)", failures)
    if global_model:
        if opencode.get("model") != global_model:
            fail(f"runtime projection drift: top-level model {opencode.get('model')!r} != global_agent_model {global_model!r} (run sync-opencode-models.js --write)", failures)
    elif "model" in opencode:
        fail(f"runtime projection drift: no global_agent_model but opencode.json sets top-level model {opencode.get('model')!r} (run sync-opencode-models.js --write)", failures)

    # .opencode/agent/*.md frontmatter is a second configured-model surface
    # OpenCode loads: explicit entries project an exact `model:` line,
    # inheriting entries project NO `model:` line.
    for name, req in (manifest.get("agents") or {}).items():
        md_path = ROOT / ".opencode" / "agent" / f"{name}.md"
        if not md_path.is_file():
            fail(f"runtime projection: agent '{name}' in manifest but missing .opencode/agent/{name}.md", failures)
            continue
        fm_model = _frontmatter_model(md_path.read_text(encoding="utf-8"))
        if fm_model == "__NO_FRONTMATTER__":
            fail(f"runtime projection: .opencode/agent/{name}.md has no frontmatter block", failures)
        elif req.get("model"):
            if fm_model != req.get("model"):
                fail(f"runtime projection drift: agent '{name}' .opencode/agent/{name}.md frontmatter {fm_model!r} != manifest {req.get('model')!r} (run sync-opencode-models.js --write)", failures)
        elif fm_model is not None:
            fail(f"runtime projection drift: agent '{name}' inherits but .opencode/agent/{name}.md frontmatter pins {fm_model!r} (run sync-opencode-models.js --write)", failures)

    # Runtime prerequisites: operator-owned, never provision.
    prereqs = json.loads(PREREQS.read_text(encoding="utf-8"))
    pschema = json.loads(PREREQS_SCHEMA.read_text(encoding="utf-8"))
    for error in Draft7Validator(pschema).iter_errors(prereqs):
        fail(f"prerequisites schema: {list(error.path)}: {error.message}", failures)

    catalog = json.loads(INSTALLER_CATALOG.read_text(encoding="utf-8"))
    boundary = catalog.get("_boundary") or {}
    if boundary.get("ownership") != "operator-owned-external-reference-only":
        fail("installer catalog missing operator-owned boundary marker", failures)
    if boundary.get("execution") != "never-executed-by-workflow":
        fail("installer catalog missing never-executed-by-workflow marker", failures)
    if boundary.get("managed_by_aiw") is not False:
        fail("installer catalog managed_by_aiw must be false", failures)
    if boundary.get("lifecycle") != "transitional-technical-debt":
        fail("installer catalog must be marked transitional-technical-debt (delete once O4 migrates)", failures)
    if not boundary.get("deprecation_note"):
        fail("installer catalog missing deprecation_note", failures)

    if failures:
        for item in failures:
            print(f"FAIL: {item}")
        return 1
    print(f"PASS: model policy valid ({len(manifest.get('agents', {}))} agents, {len(manifest.get('tasks', {}))} tasks; {explicit_count} explicit, {inherit_count} inherit; global={'none' if not global_model else global_model}); router references resolve; opencode.json projection in sync; runtime boundary markers present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

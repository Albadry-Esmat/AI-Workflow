#!/usr/bin/env python3
"""Onboarding O2: resumable, agent-neutral setup and runtime selection controls."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
POLICY_PATH = CONFIG / "onboarding-o2-policy.json"
CONTRACT_PATH = CONFIG / "onboarding-o2-contract.json"
CATALOG_PATH = CONFIG / "agent-runtime-catalog.json"
STATE_ROOT = Path(os.environ.get("AIW_O2_STATE_ROOT", str(ROOT / ".aiw" / "onboarding-o2")))
STATE_PATH = STATE_ROOT / "state.json"
EVIDENCE_PATH = STATE_ROOT / "evidence.jsonl"

STEP_IDS = [
    "preflight", "core-toolchain", "project-config", "cli-link",
    "runtime-detect", "runtime-select", "no-secret-demo", "auth-status", "complete",
]
VERSION_RE = re.compile(r"(?<!\d)(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?")
SECRET_ENV_NAMES = {
    "GITHUB_TOKEN", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "BRAVE_API_KEY",
    "CONTEXT7_API_KEY", "VERCEL_TOKEN", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def workflow_id() -> str:
    return hashlib.sha256(str(ROOT.resolve()).encode("utf-8")).hexdigest()[:32]


def state_dir() -> Path:
    return STATE_PATH.parent


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def append_evidence(event: str, payload: dict[str, Any]) -> None:
    state_dir().mkdir(parents=True, exist_ok=True)
    safe = {"timestamp": now(), "event": event, **payload}
    with EVIDENCE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe, sort_keys=True) + "\n")


def initial_state(mode: str) -> dict[str, Any]:
    timestamp = now()
    return {
        "schema_version": "1.0.0",
        "workflow_id": workflow_id(),
        "mode": mode,
        "steps": [
            {"id": step, "status": "pending", "attempts": 0, "mutates_machine": step in {"core-toolchain", "project-config", "cli-link", "runtime-select"}, "requires_auth": False, "started_at": None, "completed_at": None, "error_code": None, "message": None}
            for step in STEP_IDS
        ],
        "runtime_selection": {"adapter_id": None, "selection_mode": "none", "availability": "unknown", "version": None, "selected_at": None, "evidence_recorded": False},
        "auth": {"status": "not-requested", "adapter_id": None, "secret_values_stored": False, "delegated": True, "last_checked_at": None, "redacted_source": None},
        "demo": {"status": "not-run", "external_writes": 0, "secrets_seen": False, "evidence_path": None},
        "recovery": {"recoverable": True, "owned_paths": [".aiw/onboarding-o2"], "rollback_required": False, "last_failure_step": None},
        "updated_at": timestamp,
    }


def load_state() -> dict[str, Any] | None:
    if not STATE_PATH.is_file():
        return None
    try:
        state = load_json(STATE_PATH)
    except (OSError, json.JSONDecodeError):
        raise RuntimeError("O2-STATE-CORRUPT: onboarding state is unreadable; run `aiw recover --reset-state`")
    if state.get("schema_version") != "1.0.0" or state.get("workflow_id") != workflow_id():
        raise RuntimeError("O2-STATE-UNKNOWN: onboarding state belongs to an unknown schema or workflow")
    return state


def save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = now()
    atomic_json(STATE_PATH, state)


def step(state: dict[str, Any], step_id: str) -> dict[str, Any]:
    return next(item for item in state["steps"] if item["id"] == step_id)


def mark_step(state: dict[str, Any], step_id: str, status: str, message: Any = None, error_code: str | None = None) -> None:
    item = step(state, step_id)
    item["attempts"] += 1
    item["status"] = status
    item["message"] = message
    item["error_code"] = error_code
    item["started_at"] = item["started_at"] or now()
    item["completed_at"] = now() if status in {"passed", "warned", "failed", "skipped", "blocked"} else None
    state["recovery"]["last_failure_step"] = step_id if status in {"failed", "blocked"} else state["recovery"].get("last_failure_step")
    save_state(state)


def emit(value: Any, as_json: bool, title: str | None = None) -> None:
    if as_json:
        print(json.dumps(value, indent=2, sort_keys=True))
        return
    if title:
        print(f"\n{title}")
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                print(f"  {key}: {json.dumps(item, sort_keys=True)}")
            else:
                print(f"  {key}: {item}")
    else:
        print(value)


def version_from_output(output: str) -> str | None:
    match = VERSION_RE.search(output)
    return match.group(0) if match else None


def safe_executable(adapter: dict[str, Any]) -> str | None:
    executable = adapter["detection"]["executable"]
    if executable == "user-defined":
        # Operator-provided command line: probe its first token only. The full
        # string is rejected if it contains shell metacharacters; aiw start
        # word-splits it identically at launch.
        full = os.environ.get("AIW_AGENT_COMMAND", "").strip()
        if not full or any(char in full for char in ";&|<>$`\n"):
            return None
        executable = full.split()[0]
    if not executable or any(char in executable for char in ";&|<>$`\n"):
        return None
    return shutil.which(executable) or (executable if Path(executable).is_file() else None)


def detect_adapter(adapter: dict[str, Any]) -> dict[str, Any]:
    executable = safe_executable(adapter)
    result: dict[str, Any] = {
        "adapter_id": adapter["id"],
        "display_name": adapter["display_name"],
        "support_level": adapter["support_level"],
        "executable": adapter["detection"]["executable"],
        "available": False,
        "version": None,
        "probe": "not-run",
        "reason": "not detected",
        "secrets_seen": False,
        "external_writes": 0,
    }
    if not executable:
        result["reason"] = "executable not found or not configured"
        return result
    command = [executable, *adapter["detection"].get("version_args", ["--version"])]
    env = {"PATH": os.environ.get("PATH", "")}
    try:
        completed = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=5, check=False)
    except (OSError, subprocess.SubprocessError) as exc:
        result["probe"] = "error"
        result["reason"] = type(exc).__name__
        return result
    result["probe"] = "passed" if completed.returncode == 0 else "failed"
    version = version_from_output((completed.stdout + " " + completed.stderr)[:256])
    result["version"] = version
    if completed.returncode == 0 and (version or not adapter["detection"].get("version_output_required", True)):
        result["available"] = True
        result["reason"] = "safe version probe passed"
    else:
        result["reason"] = "version probe failed or returned no version"
    return result


def catalog() -> list[dict[str, Any]]:
    return load_json(CATALOG_PATH)["adapters"]


def detect_all() -> dict[str, Any]:
    results = [detect_adapter(adapter) for adapter in catalog()]
    return {"schema_version": "1.0.0", "timestamp": now(), "results": results, "external_writes": 0, "secrets_seen": False}


def toolchain_check() -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="aiw-o2-doctor-") as directory:
        output = Path(directory) / "toolchain.json"
        command = [sys.executable, str(ROOT / "scripts/check-toolchain.py"), "--check-only", "--no-network", "--json-output", str(output)]
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
        if output.is_file():
            result = load_json(output)
        else:
            result = {"verdict": "fail", "failures": ["toolchain checker produced no JSON"], "stdout": completed.stdout[-500:], "stderr": completed.stderr[-500:]}
        result["exit_code"] = completed.returncode
        return result


def mcp_doctor() -> dict[str, Any]:
    """S1 MCP diagnostics: manifest validity (names only) + projection freshness."""
    manifest_path = CONFIG / "mcp-manifest.json"
    schema_path = CONFIG / "mcp-manifest-schema.json"
    info: dict[str, Any] = {"manifest_present": manifest_path.is_file(), "manifest_valid": False,
                            "projections_fresh": False, "servers": [], "raw_secret_values": 0}
    if not info["manifest_present"]:
        return info
    try:
        import jsonschema  # type: ignore

        manifest = load_json(manifest_path)
        jsonschema.validate(manifest, load_json(schema_path))
        info["manifest_valid"] = True
        info["servers"] = sorted(manifest.get("servers", {}).keys())
    except Exception as exc:
        info["manifest_error"] = type(exc).__name__
        return info
    try:
        completed = subprocess.run(["node", str(ROOT / "scripts/sync-mcp.js"), "--check"],
                                   cwd=ROOT, capture_output=True, text=True, check=False)
        info["projections_fresh"] = completed.returncode == 0
        if completed.returncode != 0:
            info["projections_output"] = (completed.stdout + completed.stderr)[-500:]
    except (OSError, subprocess.SubprocessError):
        info["projections_error"] = "node unavailable"
    return info


def opener_doctor() -> list[dict[str, Any]]:
    """S2 IDE opener status: for opener-launch adapters, opener presence on PATH.

    Names only; never executes the opener. Absent openers mean guidance
    fallback at start time (fail-safe, never an error here).
    """
    items = []
    for adapter in catalog():
        if adapter.get("launch_kind") != "opener-launch":
            continue
        for opener in adapter.get("openers", []) or []:
            if not opener.get("verified"):
                continue
            items.append({"adapter_id": adapter["id"], "opener": opener.get("executable"),
                          "verified": True, "present": bool(shutil.which(opener.get("executable", "")))})
    return items


def doctor(as_json: bool) -> int:
    detection = detect_all()
    toolchain = toolchain_check()
    state = load_state()
    mcp = mcp_doctor()
    resolution = resolve_runtime("auto", ROOT, dry_run=True)
    report = {
        "schema_version": "1.0.0",
        "command": "aiw doctor",
        "timestamp": now(),
        "toolchain": toolchain,
        "runtime_detection": detection,
        "runtime_resolution": {k: v for k, v in resolution.items() if k != "detections"},
        "ide_openers": opener_doctor(),
        "mcp": mcp,
        "state": {"present": state is not None, "status": "available" if state else "not-started", "path": str(STATE_PATH.relative_to(ROOT))},
        "authentication": {"status": "delegated", "raw_secret_values": 0},
        "required_failures": len(toolchain.get("failures", [])),
        "warnings": [r["reason"] for r in detection["results"] if not r["available"]],
        "verdict": "pass" if toolchain.get("verdict") == "pass" else "fail",
    }
    emit(report, as_json, "AI Workflow O2 Doctor")
    return 0 if report["verdict"] == "pass" else 1


def agent_list(as_json: bool) -> int:
    items = [{"id": a["id"], "display_name": a["display_name"], "support_level": a["support_level"], "status": a["status"], "managed_by_aiw": a["installation"]["managed_by_aiw"]} for a in catalog()]
    emit({"adapters": items, "runtime_neutral": True, "runtime_installation": "deferred-and-user-controlled"} if as_json else {"adapters": items}, as_json, "Available agent adapters")
    return 0


def agent_detect(as_json: bool) -> int:
    result = detect_all()
    append_evidence("runtime-detected", {"available_adapters": [r["adapter_id"] for r in result["results"] if r["available"]], "external_writes": 0, "secrets_seen": False})
    emit(result, as_json, "Agent runtime detection")
    return 0


def scan_markers(target: Path) -> list[str]:
    """S1 adapter IDs whose project_markers exist in target (selection input only)."""
    found: list[str] = []
    try:
        entries = {entry.name for entry in target.iterdir()}
    except OSError:
        return found
    for adapter in catalog():
        for marker in adapter.get("project_markers", []) or []:
            if marker.rstrip("/") in entries:
                found.append(adapter["id"])
                break
    order = [a["id"] for a in catalog()]
    return sorted(found, key=order.index)


def display_order() -> list[str]:
    """Catalog precedence orders candidate display only; it never picks a runtime."""
    return load_json(POLICY_PATH)["selection"]["auto_precedence"]


def verified_opener(adapter: dict[str, Any]) -> str | None:
    """S2 first verified opener executable found on PATH, else None.

    Verified means the catalog documents the opener as tested; presence is
    proven by PATH lookup (hermetic under test fixture PATHs). Unverified or
    absent openers never launch — callers fall back to external guidance.
    """
    for opener in adapter.get("openers", []) or []:
        if opener.get("verified") and shutil.which(opener.get("executable", "")):
            return opener["executable"]
    return None


def resolve_runtime(for_id: str, target: Path, dry_run: bool) -> dict[str, Any]:
    """S1 deterministic runtime resolution (levels 1-6). Persists unless dry_run."""
    adapters = {a["id"]: a for a in catalog()}
    detection = detect_all()
    by_id = {item["adapter_id"]: item for item in detection["results"]}
    available = {aid for aid, item in by_id.items() if item.get("available")}
    marked = scan_markers(target)

    def persist(chosen: str, mode: str) -> dict[str, Any]:
        record = {"adapter_id": chosen, "selection_mode": mode, "availability": "detected",
                  "version": by_id[chosen].get("version"), "selected_at": now(), "evidence_recorded": True}
        if not dry_run:
            state = load_state() or initial_state("apply")
            state["runtime_selection"] = record
            mark_step(state, "runtime-select", "passed", f"selected {chosen} ({mode})")
            append_evidence("runtime-selected", {"adapter_id": chosen, "selection_mode": mode,
                                                 "version": record["version"], "external_writes": 0, "secrets_seen": False})
        return record

    def ambiguous(candidates: list[str], level: str) -> dict[str, Any]:
        ordered = [c for c in display_order() if c in candidates]
        return {"verdict": "fail", "error_code": "O2-RUNTIME-AMBIGUOUS", "level": level,
                "candidates": ordered, "fallback": False,
                "guidance": "Multiple runtimes are equally valid. Run: aiw agent use <runtime> — " + ", ".join(ordered)}

    # Level 1 — explicit CLI argument.
    if for_id != "auto":
        if for_id not in adapters:
            return {"verdict": "fail", "error_code": "O2-ADAPTER-UNKNOWN", "adapter_id": for_id, "fallback": False}
        adapter = adapters[for_id]
        if adapter.get("launch_kind") in ("ide-guidance", "opener-launch"):
            if for_id in marked or not marked:
                opener = verified_opener(adapter) if adapter.get("launch_kind") == "opener-launch" else None
                if opener:
                    record = persist(for_id, "explicit-arg-opener")
                    return {"verdict": "pass", **record, "launch": "opener-launch", "opener": opener,
                            "fallback": False,
                            "reason": "explicit IDE runtime selection; verified opener launch"}
                record = persist(for_id, "explicit-arg-guidance")
                return {"verdict": "pass", **record, "launch": "external-guidance",
                        "reason": "explicit IDE runtime selection; external launch required"}
            return {"verdict": "fail", "error_code": "O2-ADAPTER-MISSING", "adapter_id": for_id,
                    "selection_mode": "explicit", "fallback": False,
                    "guidance": f"Target has no {for_id} project markers ({', '.join(marked) or 'none found'})"}
        if for_id not in available:
            return {"verdict": "fail", "error_code": "O2-ADAPTER-MISSING", "adapter_id": for_id,
                    "selection_mode": "explicit", "fallback": False, "detection": by_id.get(for_id),
                    "guidance": f"Install {adapter['display_name']} or run: aiw agent detect"}
        record = persist(for_id, "explicit-arg")
        return {"verdict": "pass", **record, "fallback": False}

    # Level 2 — explicitly persisted selection (stale fails closed, never switches).
    state = load_state()
    persisted = (state or {}).get("runtime_selection", {}).get("adapter_id")
    stale_note = None
    if persisted:
        if persisted not in adapters:
            return {"verdict": "fail", "error_code": "O2-ADAPTER-UNKNOWN", "adapter_id": persisted,
                    "fallback": False, "guidance": "Persisted selection is unknown; run: aiw agent use auto"}
        if persisted not in available:
            return {"verdict": "fail", "error_code": "O2-RUNTIME-STALE", "adapter_id": persisted,
                    "selection_mode": "persisted", "fallback": False,
                    "warning": f"Persisted runtime '{persisted}' is no longer available; no silent switch performed.",
                    "guidance": "Run: aiw agent use auto — or: aiw agent use <runtime>"}
        p_markers = set(adapters[persisted].get("project_markers", []) or [])
        if (not marked) or (persisted in marked) or (not p_markers):
            record = persist(persisted, "persisted")
            out = {"verdict": "pass", **record, "fallback": False}
            if adapters[persisted].get("launch_kind") in ("ide-guidance", "opener-launch"):
                opener = (verified_opener(adapters[persisted])
                          if adapters[persisted].get("launch_kind") == "opener-launch" else None)
                out["launch"] = "opener-launch" if opener else "external-guidance"
                if opener:
                    out["opener"] = opener
            return out
        stale_note = f"Persisted '{persisted}' does not match target markers; continuing resolution."

    # Levels 3-4 — project markers constrain auto candidates; singleton wins.
    if marked:
        marked_available = [m for m in marked if m in available]
        if len(marked_available) == 1:
            chosen = marked_available[0]
            if adapters[chosen].get("launch_kind") in ("ide-guidance", "opener-launch"):
                opener = (verified_opener(adapters[chosen])
                          if adapters[chosen].get("launch_kind") == "opener-launch" else None)
                if opener:
                    record = persist(chosen, "project-marker-opener")
                    out = {"verdict": "pass", **record, "launch": "opener-launch",
                           "opener": opener, "fallback": False}
                else:
                    record = persist(chosen, "project-marker-guidance")
                    out = {"verdict": "pass", **record, "launch": "external-guidance", "fallback": False}
            else:
                record = persist(chosen, "project-marker")
                out = {"verdict": "pass", **record, "fallback": False}
            if stale_note:
                out["warning"] = stale_note
            return out
        if marked_available:
            out = ambiguous(marked_available, "project-marker")
            if stale_note:
                out["warning"] = stale_note
            return out
    cli_available = [aid for aid in available if adapters.get(aid, {}).get("launch_kind") == "cli-direct"]
    pool = [m for m in marked if m in set(cli_available)] if marked else cli_available
    if len(pool) == 1:
        record = persist(pool[0], "auto")
        out = {"verdict": "pass", **record, "fallback": False}
        if stale_note:
            out["warning"] = stale_note
        return out
    if pool:
        out = ambiguous(pool, "auto-detect")
        if stale_note:
            out["warning"] = stale_note
        return out
    ide_available = [m for m in marked if m in available and adapters[m].get("launch_kind") in ("ide-guidance", "opener-launch")] if marked else []
    if len(ide_available) == 1:
        opener = (verified_opener(adapters[ide_available[0]])
                  if adapters[ide_available[0]].get("launch_kind") == "opener-launch" else None)
        if opener:
            record = persist(ide_available[0], "auto-opener")
            return {"verdict": "pass", **record, "launch": "opener-launch", "opener": opener, "fallback": False}
        record = persist(ide_available[0], "auto-guidance")
        return {"verdict": "pass", **record, "launch": "external-guidance", "fallback": False}
    if ide_available:
        return ambiguous(ide_available, "auto-guidance")

    # Level 5 — configured generic command.
    if "generic-command" in available:
        record = persist("generic-command", "generic-configured")
        return {"verdict": "pass", **record, "fallback": False}

    # Level 6 — fail closed with guidance.
    return {"verdict": "fail", "error_code": "O2-NO-RUNTIME", "selection_mode": "auto",
            "fallback": False, "detections": detection["results"],
            "guidance": "No supported runtime detected. Install one manually, set AIW_AGENT_COMMAND, or run: aiw demo"}


def agent_use(adapter_id: str, as_json: bool) -> int:
    if adapter_id != "auto" and adapter_id not in {a["id"] for a in catalog()}:
        report = {"verdict": "fail", "error_code": "O2-ADAPTER-UNKNOWN", "adapter_id": adapter_id, "fallback": False}
        emit(report, as_json, "Agent selection failed")
        return 1
    report = resolve_runtime(adapter_id, ROOT, dry_run=False)
    emit(report, as_json, "Agent runtime selected" if report.get("verdict") == "pass" else "Agent selection failed")
    return 0 if report.get("verdict") == "pass" else 1


def agent_marker_scan(target: str, as_json: bool) -> int:
    target_path = Path(target).expanduser()
    if not target_path.is_dir():
        emit({"markers": [], "error_code": "O2-TARGET-MISSING", "target": target}, as_json, "Marker scan failed")
        return 1
    emit({"markers": scan_markers(target_path.resolve()), "target": str(target_path)}, as_json, "Project markers")
    return 0


def agent_resolve(target: str, for_id: str, dry_run: bool, as_json: bool) -> int:
    target_path = Path(target).expanduser()
    if not target_path.is_dir():
        report = {"verdict": "fail", "error_code": "O2-TARGET-MISSING", "target": target, "fallback": False}
        emit(report, as_json, "Runtime resolution failed")
        return 1
    if for_id != "auto" and for_id not in {a["id"] for a in catalog()}:
        report = {"verdict": "fail", "error_code": "O2-ADAPTER-UNKNOWN", "adapter_id": for_id, "fallback": False}
        emit(report, as_json, "Runtime resolution failed")
        return 1
    report = resolve_runtime(for_id, target_path.resolve(), dry_run=dry_run)
    emit(report, as_json, "Runtime resolved" if report.get("verdict") == "pass" else "Runtime resolution failed")
    return 0 if report.get("verdict") == "pass" else 1


def demo(as_json: bool) -> int:
    with tempfile.TemporaryDirectory(prefix="aiw-o2-demo-") as directory:
        output = Path(directory) / "demo-output.txt"
        output.write_text("AI Workflow no-secret demo\nstatus=pass\nexternal_writes=0\nsecrets_seen=false\n", encoding="utf-8")
        digest = hashlib.sha256(output.read_bytes()).hexdigest()
    result = {"verdict": "pass", "demo": "no-secret", "network": "disabled", "external_writes": 0, "secrets_seen": False, "target_project_changes": 0, "output_digest": digest}
    state = load_state()
    if state is not None:
        state["demo"] = {"status": "passed", "external_writes": 0, "secrets_seen": False, "evidence_path": str(EVIDENCE_PATH.relative_to(ROOT))}
        mark_step(state, "no-secret-demo", "passed", "deterministic zero-write demo")
    append_evidence("no-secret-demo", {"external_writes": 0, "secrets_seen": False, "target_project_changes": 0, "output_digest": digest})
    emit(result, as_json, "No-secret demo")
    return 0


def auth_status(as_json: bool) -> int:
    state = load_state()
    selected = state["runtime_selection"]["adapter_id"] if state else None
    result = {"status": "delegated" if selected else "not-requested", "adapter_id": selected, "raw_secret_values": 0, "login_started": False, "credential_owner": "runtime" if selected else None}
    if state is not None:
        state["auth"] = {"status": result["status"], "adapter_id": selected, "secret_values_stored": False, "delegated": True, "last_checked_at": now(), "redacted_source": "runtime-status" if selected else None}
        mark_step(state, "auth-status", "passed", "delegated status only")
    append_evidence("auth-status", {"adapter_id": selected, "status": result["status"], "raw_secret_values": 0, "login_started": False})
    emit(result, as_json, "Authentication status")
    return 0


def setup(check_only: bool, resume: bool, as_json: bool) -> int:
    mode = "check-only" if check_only else ("resume" if resume else "apply")
    if check_only:
        report = {"verdict": "pass" if toolchain_check().get("verdict") == "pass" else "fail", "mode": mode, "mutations": 0, "network": "disabled", "runtime_installation": "not-performed", "secrets_seen": False, "toolchain": toolchain_check()}
        emit(report, as_json, "O2 check-only setup")
        return 0 if report["verdict"] == "pass" else 1
    state = load_state() if resume else None
    state = state or initial_state(mode)
    save_state(state)
    mark_step(state, "preflight", "passed", "O2 state initialized")
    if step(state, "core-toolchain")["status"] not in {"passed", "warned"}:
        mark_step(state, "core-toolchain", "running", "running O1 setup")
        completed = subprocess.run(["bash", str(ROOT / "scripts/setup.sh")], cwd=ROOT, text=True, capture_output=as_json, check=False)
        if completed.returncode != 0:
            mark_step(state, "core-toolchain", "failed", "O1 setup failed", "O2-SETUP-CORE")
            result = {"verdict": "fail", "error_code": "O2-SETUP-CORE", "resumable": True, "state_path": str(STATE_PATH.relative_to(ROOT))}
            emit(result, as_json, "O2 setup failed")
            return 1
        mark_step(state, "core-toolchain", "passed", "O1 setup completed")
    for step_id in ("project-config", "cli-link"):
        if step(state, step_id)["status"] == "pending":
            mark_step(state, step_id, "passed", "owned by O1 setup")
    detection = detect_all()
    mark_step(state, "runtime-detect", "passed", f"{sum(1 for x in detection['results'] if x['available'])} runtime(s) detected")
    mark_step(state, "runtime-select", "skipped", "selection remains explicit; use aiw agent use")
    demo(as_json=True)
    auth_status(as_json=True)
    mark_step(state, "complete", "passed", "O2 setup complete; runtime launch remains deferred")
    result = {"verdict": "pass", "mode": mode, "resumable": True, "runtime_installation": "not-performed", "runtime_selection": state["runtime_selection"], "state_path": str(STATE_PATH.relative_to(ROOT)), "next": ["aiw doctor", "aiw agent detect", "aiw demo", "aiw agent use auto"]}
    emit(result, as_json, "O2 setup complete")
    return 0


def recover(reset_state: bool, as_json: bool) -> int:
    state = load_state()
    if state is None:
        result = {"verdict": "pass", "recovered": False, "reason": "no O2 state exists", "owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0}
        emit(result, as_json, "O2 recovery")
        return 0
    if reset_state:
        if STATE_PATH.exists():
            STATE_PATH.unlink()
        result = {"verdict": "pass", "recovered": True, "reset_state": True, "owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0}
        emit(result, as_json, "O2 state reset")
        return 0
    for item in state["steps"]:
        if item["status"] in {"running", "failed", "blocked"}:
            item["status"] = "pending"
            item["error_code"] = None
            item["message"] = "reset by recover"
    state["recovery"]["rollback_required"] = False
    state["recovery"]["last_failure_step"] = None
    save_state(state)
    append_evidence("recovered", {"owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0})
    result = {"verdict": "pass", "recovered": True, "resumable": True, "state_path": str(STATE_PATH.relative_to(ROOT)), "owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0}
    emit(result, as_json, "O2 state recovered")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Workflow O2 onboarding controls")
    sub = parser.add_subparsers(dest="command", required=True)
    setup_parser = sub.add_parser("setup")
    setup_parser.add_argument("--check-only", action="store_true")
    setup_parser.add_argument("--resume", action="store_true")
    setup_parser.add_argument("--json", action="store_true")
    doctor_parser = sub.add_parser("doctor")
    doctor_parser.add_argument("--json", action="store_true")
    list_parser = sub.add_parser("agent-list")
    list_parser.add_argument("--json", action="store_true")
    detect_parser = sub.add_parser("agent-detect")
    detect_parser.add_argument("--json", action="store_true")
    use_parser = sub.add_parser("agent-use")
    use_parser.add_argument("adapter")
    use_parser.add_argument("--json", action="store_true")
    resolve_parser = sub.add_parser("agent-resolve")
    resolve_parser.add_argument("--target", default=".")
    resolve_parser.add_argument("--for", dest="for_id", default="auto")
    resolve_parser.add_argument("--dry-run", action="store_true")
    resolve_parser.add_argument("--json", action="store_true")
    markers_parser = sub.add_parser("agent-marker-scan")
    markers_parser.add_argument("--target", default=".")
    markers_parser.add_argument("--json", action="store_true")
    demo_parser = sub.add_parser("demo")
    demo_parser.add_argument("--json", action="store_true")
    auth_parser = sub.add_parser("auth-status")
    auth_parser.add_argument("--json", action="store_true")
    recover_parser = sub.add_parser("recover")
    recover_parser.add_argument("--reset-state", action="store_true")
    recover_parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "setup": return setup(args.check_only, args.resume, args.json)
        if args.command == "doctor": return doctor(args.json)
        if args.command == "agent-list": return agent_list(args.json)
        if args.command == "agent-detect": return agent_detect(args.json)
        if args.command == "agent-use": return agent_use(args.adapter, args.json)
        if args.command == "agent-resolve": return agent_resolve(args.target, args.for_id, args.dry_run, args.json)
        if args.command == "agent-marker-scan": return agent_marker_scan(args.target, args.json)
        if args.command == "demo": return demo(args.json)
        if args.command == "auth-status": return auth_status(args.json)
        if args.command == "recover": return recover(args.reset_state, args.json)
        return 2
    except RuntimeError as exc:
        report = {"verdict": "fail", "error_code": str(exc).split(":", 1)[0], "message": str(exc), "raw_secret_values": 0}
        print(json.dumps(report, indent=2) if getattr(args, "json", False) else f"O2 failure: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

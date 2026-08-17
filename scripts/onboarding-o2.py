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
        executable = os.environ.get("AIW_AGENT_COMMAND", "").strip()
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


def doctor(as_json: bool) -> int:
    detection = detect_all()
    toolchain = toolchain_check()
    state = load_state()
    report = {
        "schema_version": "1.0.0",
        "command": "aiw doctor",
        "timestamp": now(),
        "toolchain": toolchain,
        "runtime_detection": detection,
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


def agent_use(adapter_id: str, as_json: bool) -> int:
    adapters = {a["id"]: a for a in catalog()}
    if adapter_id != "auto" and adapter_id not in adapters:
        report = {"verdict": "fail", "error_code": "O2-ADAPTER-UNKNOWN", "adapter_id": adapter_id, "fallback": False}
        emit(report, as_json, "Agent selection failed")
        return 1
    detection = detect_all()
    by_id = {item["adapter_id"]: item for item in detection["results"]}
    if adapter_id == "auto":
        precedence = load_json(POLICY_PATH)["selection"]["auto_precedence"]
        selected = next((item for item in precedence if by_id.get(item, {}).get("available")), None)
        if selected is None:
            report = {"verdict": "fail", "error_code": "O2-NO-ADAPTER", "selection_mode": "auto", "fallback": False, "detections": detection["results"]}
            emit(report, as_json, "No agent runtime selected")
            return 1
        chosen = selected
        selection_mode = "auto"
    else:
        chosen = adapter_id
        selection_mode = "explicit"
        if not by_id.get(chosen, {}).get("available"):
            report = {"verdict": "fail", "error_code": "O2-ADAPTER-MISSING", "adapter_id": chosen, "selection_mode": "explicit", "fallback": False, "detection": by_id.get(chosen)}
            emit(report, as_json, "Agent selection failed")
            return 1
    selected_result = by_id[chosen]
    state = load_state() or initial_state("apply")
    state["runtime_selection"] = {"adapter_id": chosen, "selection_mode": selection_mode, "availability": "detected", "version": selected_result.get("version"), "selected_at": now(), "evidence_recorded": True}
    mark_step(state, "runtime-select", "passed", f"selected {chosen}")
    append_evidence("runtime-selected", {"adapter_id": chosen, "selection_mode": selection_mode, "version": selected_result.get("version"), "external_writes": 0, "secrets_seen": False})
    report = {"verdict": "pass", "adapter_id": chosen, "selection_mode": selection_mode, "version": selected_result.get("version"), "reason": "deterministic catalog precedence" if selection_mode == "auto" else "explicit selection", "fallback": False}
    emit(report, as_json, "Agent runtime selected")
    return 0


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
    use_parser.add_argument("adapter", choices=["auto", "opencode", "claude-code", "codex", "generic-command"])
    use_parser.add_argument("--json", action="store_true")
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

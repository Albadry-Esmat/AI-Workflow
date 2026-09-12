"""Onboarding O3: guided, agent-neutral setup planning and safe apply orchestration."""
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
POLICY_PATH = CONFIG / "onboarding-o3-policy.json"
CONTRACT_PATH = CONFIG / "onboarding-o3-contract.json"
CATALOG_PATH = CONFIG / "agent-runtime-catalog.json"
O2_SCRIPT = ROOT / "scripts" / "onboarding-o2.py"
STATE_ROOT = Path(os.environ.get("AIW_O3_STATE_ROOT", str(ROOT / ".aiw" / "onboarding-o3")))
STATE_PATH = STATE_ROOT / "state.json"
EVIDENCE_PATH = STATE_ROOT / "evidence.jsonl"
VERSION_RE = re.compile(r"(?<!\d)(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?")

STEPS = [
    ("preflight", False, False),
    ("core-toolchain", True, False),
    ("runtime-detect", False, False),
    ("runtime-select", True, False),
    ("auth-status", False, False),
    ("target-init", True, False),
    ("launch", True, True),
    ("complete", False, False),
]
LANES = {
    "native": "Use the existing host and user-managed runtime installation.",
    "project-local": "Use project-local pinned dependencies; runtime installation remains user-controlled.",
    "dev-container": "Use a repository or Codespace container; container provisioning remains user-controlled.",
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def workflow_id() -> str:
    return hashlib.sha256(str(ROOT.resolve()).encode("utf-8")).hexdigest()[:32]


def state_path_display() -> str:
    try:
        return str(STATE_PATH.relative_to(ROOT))
    except ValueError:
        return str(STATE_PATH)


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
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    safe = {"timestamp": now(), "event": event, **payload, "raw_secret_values": 0}
    with EVIDENCE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe, sort_keys=True) + "\n")


def initial_state(mode: str, lane: str, agent: str, explicit_yes: bool) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "workflow_id": workflow_id(),
        "mode": mode,
        "lane": lane,
        "consent": {
            "apply_requested": mode == "apply",
            "explicit_yes": explicit_yes,
            "runtime_installation_allowed": False,
            "raw_secrets_allowed": False,
        },
        "steps": [
            {
                "id": step_id,
                "status": "pending",
                "attempts": 0,
                "mutates_machine": mutates,
                "requires_auth": requires_auth,
                "started_at": None,
                "completed_at": None,
                "error_code": None,
                "message": None,
            }
            for step_id, mutates, requires_auth in STEPS
        ],
        "runtime": {
            "adapter_id": None,
            "selection_mode": "none",
            "availability": "unknown",
            "version": None,
            "selection_reason": None,
            "installation": "user-controlled-deferred",
            "evidence_recorded": False,
        },
        "auth": {"status": "not-requested", "delegated": True, "raw_secret_values": 0, "login_started": False},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred"},
        "recovery": {"owned_root": ".aiw/onboarding-o3", "recoverable": True, "last_failure_step": None, "rollback_required": False},
        "updated_at": now(),
        "requested_agent": agent,
    }


def load_state() -> dict[str, Any] | None:
    if not STATE_PATH.is_file():
        return None
    try:
        state = load_json(STATE_PATH)
    except (OSError, json.JSONDecodeError):
        raise RuntimeError("O3-STATE-CORRUPT: onboarding state is unreadable; run `aiw onboarding recover --reset-state`")
    if state.get("schema_version") != "1.0.0" or state.get("workflow_id") != workflow_id():
        raise RuntimeError("O3-STATE-UNKNOWN: onboarding state belongs to an unknown schema or workflow")
    return state


def save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = now()
    state.pop("requested_agent", None)
    atomic_json(STATE_PATH, state)


def mark_step(state: dict[str, Any], step_id: str, status: str, message: str | None = None, error_code: str | None = None) -> None:
    item = next(item for item in state["steps"] if item["id"] == step_id)
    item["attempts"] += 1
    item["status"] = status
    item["message"] = message
    item["error_code"] = error_code
    item["started_at"] = item["started_at"] or now()
    item["completed_at"] = now() if status in {"passed", "warned", "failed", "skipped", "blocked"} else None
    if status in {"failed", "blocked"}:
        state["recovery"]["last_failure_step"] = step_id
        state["recovery"]["rollback_required"] = True
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


def catalog() -> list[dict[str, Any]]:
    return load_json(CATALOG_PATH)["adapters"]


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
        "vendor": adapter["vendor"],
        "documentation_url": adapter["documentation"]["official_url"],
        "available": False,
        "version": None,
        "probe": "not-run",
        "reason": "not detected",
        "installation": "user-controlled-deferred",
        "installation_channels": [channel["name"] for channel in adapter["installation"]["channels"]],
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


def detect_all() -> list[dict[str, Any]]:
    return [detect_adapter(adapter) for adapter in catalog()]


def select_runtime(requested: str, detections: list[dict[str, Any]]) -> dict[str, Any]:
    known = {adapter["id"]: adapter for adapter in catalog()}
    by_id = {item["adapter_id"]: item for item in detections}
    if requested != "auto" and requested not in known:
        return {"verdict": "fail", "error_code": "O3-ADAPTER-UNKNOWN", "adapter_id": requested, "selection_mode": "explicit", "fallback": False}
    if requested == "auto":
        precedence = load_json(POLICY_PATH)["runtime"].get("auto_precedence", [item["id"] for item in catalog()])
        selected = next((item for item in precedence if by_id.get(item, {}).get("available")), None)
        if selected is None:
            return {
                "verdict": "deferred",
                "adapter_id": None,
                "selection_mode": "auto",
                "availability": "deferred",
                "version": None,
                "reason": "no catalog adapter detected; installation remains user-controlled",
                "fallback": False,
            }
        chosen = selected
        selection_mode = "auto"
        reason = "deterministic O3 policy precedence"
    else:
        chosen = requested
        selection_mode = "explicit"
        if not by_id.get(chosen, {}).get("available"):
            return {
                "verdict": "fail",
                "error_code": "O3-ADAPTER-MISSING",
                "adapter_id": chosen,
                "selection_mode": "explicit",
                "availability": "missing",
                "fallback": False,
                "detection": by_id.get(chosen),
            }
        reason = "explicit user selection"
    selected = by_id[chosen]
    return {
        "verdict": "pass",
        "adapter_id": chosen,
        "selection_mode": selection_mode,
        "availability": "available",
        "version": selected.get("version"),
        "reason": reason,
        "fallback": False,
    }


def toolchain_check() -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="aiw-o3-doctor-") as directory:
        output = Path(directory) / "toolchain.json"
        command = [sys.executable, str(ROOT / "scripts/check-toolchain.py"), "--check-only", "--no-network", "--json-output", str(output)]
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
        if output.is_file():
            result = load_json(output)
        else:
            result = {"verdict": "fail", "failures": ["toolchain checker produced no JSON"]}
        result["exit_code"] = completed.returncode
        return result


def base_report(lane: str, requested_agent: str, detections: list[dict[str, Any]], selection: dict[str, Any], mode: str) -> dict[str, Any]:
    selection_copy = {key: value for key, value in selection.items() if key != "detection"}
    available = [item["adapter_id"] for item in detections if item["available"]]
    steps = [
        {"id": "preflight", "status": "passed", "mutates_machine": False, "requires_auth": False, "message": "guided boundary validated"},
        {"id": "core-toolchain", "status": "planned", "mutates_machine": True, "requires_auth": False, "message": "reuse O1 deterministic setup only in explicit apply mode"},
        {"id": "runtime-detect", "status": "passed" if available else "warned", "mutates_machine": False, "requires_auth": False, "message": f"{len(available)} catalog adapter(s) detected"},
        {"id": "runtime-select", "status": "passed" if selection["verdict"] == "pass" else ("warned" if selection["verdict"] == "deferred" else "blocked"), "mutates_machine": True, "requires_auth": False, "message": selection.get("reason")},
        {"id": "auth-status", "status": "skipped", "mutates_machine": False, "requires_auth": False, "message": "delegated to selected runtime; no login started"},
        {"id": "target-init", "status": "skipped", "mutates_machine": True, "requires_auth": False, "message": "deferred to a later guarded batch"},
        {"id": "launch", "status": "skipped", "mutates_machine": True, "requires_auth": True, "message": "deferred to a later launch adapter batch"},
        {"id": "complete", "status": "planned", "mutates_machine": False, "requires_auth": False, "message": "apply only after explicit consent"},
    ]
    return {
        "schema_version": "1.0.0",
        "command": f"aiw onboarding {mode}",
        "verdict": "pass" if selection["verdict"] in {"pass", "deferred"} else "fail",
        "mode": mode,
        "lane": lane,
        "lane_description": LANES[lane],
        "requested_agent": requested_agent,
        "runtime_detection": {"results": detections, "external_writes": 0, "secrets_seen": False},
        "runtime_selection": selection_copy,
        "installation": {"status": "deferred", "managed_by_aiw": False, "commands_executed": 0, "consent_required": True},
        "authentication": {"status": "delegated", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred"},
        "steps": steps,
        "mutations": 0,
        "network": "disabled" if mode == "plan" else "not-used-by-o3",
        "raw_secret_values": 0,
        "next_actions": [
            "Install a selected runtime using one of its catalog channels, outside AI-Workflow",
            "Run aiw agent detect and aiw agent use <id|auto>",
            "Authenticate through the selected runtime when needed",
        ],
    }


def plan(lane: str, requested_agent: str, as_json: bool) -> int:
    detections = detect_all()
    selection = select_runtime(requested_agent, detections)
    report = base_report(lane, requested_agent, detections, selection, "plan")
    emit(report, as_json, "O3 guided onboarding plan")
    return 0 if report["verdict"] == "pass" else 1


def apply(lane: str, requested_agent: str, explicit_yes: bool, resume: bool, as_json: bool) -> int:
    if not explicit_yes:
        report = {"verdict": "fail", "error_code": "O3-CONSENT-REQUIRED", "message": "apply requires explicit --yes; runtime installation and login remain deferred", "mutations": 0, "network": "disabled", "raw_secret_values": 0}
        emit(report, as_json, "O3 apply blocked")
        return 1
    detections = detect_all()
    selection = select_runtime(requested_agent, detections)
    if selection["verdict"] == "fail":
        report = base_report(lane, requested_agent, detections, selection, "apply")
        report["error_code"] = selection.get("error_code")
        emit(report, as_json, "O3 apply blocked")
        return 1
    state = load_state() if resume else None
    state = state or initial_state("apply", lane, requested_agent, explicit_yes)
    state["lane"] = lane
    state["consent"]["apply_requested"] = True
    state["consent"]["explicit_yes"] = True
    state["runtime"].update({
        "adapter_id": selection.get("adapter_id"),
        "selection_mode": selection.get("selection_mode", "auto"),
        "availability": selection.get("availability", "deferred"),
        "version": selection.get("version"),
        "selection_reason": selection.get("reason"),
        "evidence_recorded": True,
    })
    mark_step(state, "preflight", "passed", "explicit O3 apply consent received")
    mark_step(state, "runtime-detect", "passed" if any(item["available"] for item in detections) else "warned", "safe catalog probes completed")
    mark_step(state, "runtime-select", "passed" if selection["verdict"] == "pass" else "skipped", selection.get("reason"))
    append_evidence("runtime-guided-selection", {"adapter_id": selection.get("adapter_id"), "selection_mode": selection.get("selection_mode"), "availability": selection.get("availability"), "external_writes": 0})
    completed = subprocess.run([sys.executable, str(O2_SCRIPT), "setup", "--resume", "--json"], cwd=ROOT, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        mark_step(state, "core-toolchain", "failed", "O2 core setup failed", "O3-CORE-SETUP")
        report = base_report(lane, requested_agent, detections, selection, "apply")
        report.update({"verdict": "fail", "error_code": "O3-CORE-SETUP", "mutations": 0, "network": "delegated-to-o1-setup"})
        emit(report, as_json, "O3 apply failed")
        return 1
    mark_step(state, "core-toolchain", "passed", "O1 deterministic core setup completed")
    mark_step(state, "auth-status", "skipped", "authentication remains runtime-owned")
    mark_step(state, "target-init", "skipped", "target initialization remains deferred")
    mark_step(state, "launch", "skipped", "runtime launch remains deferred")
    mark_step(state, "complete", "passed", "guided O3 apply complete; installation, auth, init, and launch remain deferred")
    save_state(state)
    append_evidence("guided-apply-complete", {"lane": lane, "adapter_id": selection.get("adapter_id"), "runtime_installation": "not-performed", "target_project_changes": 0})
    report = base_report(lane, requested_agent, detections, selection, "apply")
    report.update({"mutations": 1, "network": "delegated-to-o1-setup", "state_path": state_path_display(), "resumable": True})
    emit(report, as_json, "O3 guided onboarding applied")
    return 0


def doctor(as_json: bool) -> int:
    detections = detect_all()
    toolchain = toolchain_check()
    state = load_state()
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding doctor",
        "verdict": "pass" if toolchain.get("verdict") == "pass" else "fail",
        "toolchain": toolchain,
        "runtime_detection": {"results": detections, "external_writes": 0, "secrets_seen": False},
        "state": {"present": state is not None, "path": state_path_display(), "owned_root": ".aiw/onboarding-o3"},
        "installation": {"status": "deferred", "managed_by_aiw": False, "commands_executed": 0},
        "authentication": {"status": "delegated", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred"},
        "warnings": [item["reason"] for item in detections if not item["available"]],
    }
    emit(report, as_json, "O3 guided onboarding doctor")
    return 0 if report["verdict"] == "pass" else 1


def recover(reset_state: bool, as_json: bool) -> int:
    state = load_state()
    if state is None:
        report = {"verdict": "pass", "recovered": False, "reason": "no O3 state exists", "owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0}
        emit(report, as_json, "O3 recovery")
        return 0
    if reset_state:
        if STATE_ROOT.exists():
            shutil.rmtree(STATE_ROOT)
        report = {"verdict": "pass", "recovered": True, "reset_state": True, "owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0}
        emit(report, as_json, "O3 state reset")
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
    report = {"verdict": "pass", "recovered": True, "resumable": True, "state_path": state_path_display(), "owned_paths_only": True, "target_project_changes": 0, "runtime_changes": 0}
    emit(report, as_json, "O3 state recovered")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Workflow O3 guided agent-neutral onboarding")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("plan", "apply"):
        command = sub.add_parser(name)
        command.add_argument("--lane", choices=sorted(LANES), required=True)
        command.add_argument("--agent", choices=["auto", "opencode", "claude-code", "codex", "generic-command"], default="auto")
        command.add_argument("--json", action="store_true")
        if name == "apply":
            command.add_argument("--yes", action="store_true")
            command.add_argument("--resume", action="store_true")
    doctor_parser = sub.add_parser("doctor")
    doctor_parser.add_argument("--json", action="store_true")
    recover_parser = sub.add_parser("recover")
    recover_parser.add_argument("--reset-state", action="store_true")
    recover_parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "plan":
            return plan(args.lane, args.agent, args.json)
        if args.command == "apply":
            return apply(args.lane, args.agent, args.yes, args.resume, args.json)
        if args.command == "doctor":
            return doctor(args.json)
        if args.command == "recover":
            return recover(args.reset_state, args.json)
        return 2
    except RuntimeError as exc:
        report = {"verdict": "fail", "error_code": str(exc).split(":", 1)[0], "message": str(exc), "raw_secret_values": 0}
        print(json.dumps(report, indent=2) if getattr(args, "json", False) else f"O3 failure: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Onboarding O5: digest-bound local artifact verification and execution."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform as platform_module
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
POLICY_PATH = CONFIG / "onboarding-o5-policy.json"
CATALOG_PATH = CONFIG / "runtime-installer-o5-catalog.json"
STATE_ROOT = Path(os.environ.get("AIW_O5_STATE_ROOT", str(ROOT / ".aiw" / "onboarding-o5")))
STATE_PATH = STATE_ROOT / "state.json"
EVIDENCE_PATH = STATE_ROOT / "evidence.jsonl"
STAGING_ROOT = Path(os.environ.get("AIW_O5_STAGING_ROOT", str(STATE_ROOT / "staging")))
FORBIDDEN_TOKEN_RE = re.compile(r"[;&|<>$`\n\r]")
SECRET_RE = re.compile(r"(?i)(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*[^\s,;]+")


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_policy() -> dict[str, Any]:
    return load_json(POLICY_PATH)


def load_records() -> list[dict[str, Any]]:
    return load_json(CATALOG_PATH)["records"]


def workflow_id() -> str:
    return hashlib.sha256(str(ROOT.resolve()).encode("utf-8")).hexdigest()[:32]


def state_path_display() -> str:
    try:
        return str(STATE_PATH.relative_to(ROOT))
    except ValueError:
        return str(STATE_PATH)


def staging_path_display(path: Path | None) -> str | None:
    if path is None:
        return None
    try:
        return str(path.resolve().relative_to(STAGING_ROOT.resolve()))
    except ValueError:
        return None


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
    safe = dict(payload)
    safe["raw_secret_values"] = 0
    safe.pop("stdout", None)
    safe.pop("stderr", None)
    with EVIDENCE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": now(), "event": event, **safe}, sort_keys=True) + "\n")


def redact_reason(reason: str | None) -> str | None:
    if reason is None:
        return None
    cleaned = SECRET_RE.sub(r"\1=<redacted>", reason.replace("\n", " ").replace("\r", " "))
    return cleaned[:200]


def current_platform() -> str:
    override = os.environ.get("AIW_O5_PLATFORM", "").strip().lower()
    if override in {"linux", "macos", "windows"}:
        return override
    if sys.platform.startswith("linux"):
        return "linux"
    if sys.platform == "darwin":
        return "macos"
    if sys.platform.startswith("win"):
        return "windows"
    return "unknown"


def current_architecture() -> str:
    override = os.environ.get("AIW_O5_ARCH", "").strip().lower()
    if override in {"x64", "arm64"}:
        return override
    machine = platform_module.machine().lower()
    if machine in {"aarch64", "arm64"}:
        return "arm64"
    if machine in {"x86_64", "amd64", "x64"}:
        return "x64"
    return "unknown"


def find_record(installer_id: str) -> dict[str, Any] | None:
    return next((record for record in load_records() if record["installer_id"] == installer_id), None)


def platform_matches(record: dict[str, Any]) -> bool:
    return record["platform"] == current_platform() and record["architecture"] in {"any", current_architecture()}


def resolve_candidate(record: dict[str, Any], requested_path: str | None) -> tuple[Path | None, list[str]]:
    reasons: list[str] = []
    relative_name = record["artifact"]["local_path"]
    candidate = Path(requested_path) if requested_path else STAGING_ROOT / relative_name
    try:
        resolved = candidate.expanduser().resolve(strict=False)
        staging_resolved = STAGING_ROOT.expanduser().resolve(strict=False)
        resolved.relative_to(staging_resolved)
    except (OSError, ValueError):
        return None, ["artifact path is outside the O5 staging root"]
    if candidate.is_symlink() or any(parent.is_symlink() for parent in candidate.parents if parent != candidate.parent):
        reasons.append("artifact symlink is forbidden")
    if resolved.name != Path(relative_name).name or Path(relative_name).parent != Path("."):
        reasons.append("artifact path does not exactly match the catalog filename")
    if FORBIDDEN_TOKEN_RE.search(str(candidate)):
        reasons.append("artifact path contains forbidden shell metacharacters")
    if reasons:
        return None, reasons
    return resolved, []


def sha256_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    return f"sha256:{digest.hexdigest()}", size


def hash_result(record: dict[str, Any], requested_path: str | None) -> dict[str, Any]:
    path, path_reasons = resolve_candidate(record, requested_path)
    expected = record["artifact"]["expected_sha256"]
    expected_size = record["artifact"]["expected_size_bytes"]
    result: dict[str, Any] = {
        "installer_id": record["installer_id"],
        "artifact_path": staging_path_display(path),
        "expected_sha256": expected,
        "observed_sha256": None,
        "expected_size_bytes": expected_size,
        "observed_size_bytes": None,
        "path_owned": path is not None,
        "hash_status": "blocked" if path_reasons else "not-run",
        "reasons": path_reasons,
    }
    if path is None:
        return result
    if not path.is_file():
        result["hash_status"] = "missing"
        result["reasons"] = ["artifact is missing from the O5 staging root"]
        return result
    try:
        observed, size = sha256_file(path)
    except OSError as exc:
        result["hash_status"] = "blocked"
        result["reasons"] = [f"artifact could not be read: {type(exc).__name__}"]
        return result
    result["observed_sha256"] = observed
    result["observed_size_bytes"] = size
    if observed != expected:
        result["hash_status"] = "mismatch"
        result["reasons"] = ["SHA-256 digest does not match the exact catalog record"]
    elif size != expected_size:
        result["hash_status"] = "mismatch"
        result["reasons"] = ["artifact size does not match the exact catalog record"]
    else:
        result["hash_status"] = "passed"
        result["reasons"] = []
    return result


def validate_argv(record: dict[str, Any]) -> list[str]:
    execution = record["execution"]
    argv = execution["argv"]
    reasons: list[str] = []
    if execution["shell"] or execution["network"] or execution["elevated"] or execution["stdin"] != "closed":
        reasons.append("record execution policy is not closed and local-only")
    if execution["cwd_policy"] != "o5-owned-staging" or execution["environment_policy"] != "allowlist-empty":
        reasons.append("record execution ownership policy is not O5 staging and empty environment")
    if len(argv) < 2 or argv.count("{artifact}") != 1:
        reasons.append("argv must contain exactly one {artifact} placeholder")
    if not argv or not Path(argv[0]).is_absolute():
        reasons.append("argv executable must be an absolute local path")
    if any(FORBIDDEN_TOKEN_RE.search(token) for token in argv if token != "{artifact}"):
        reasons.append("argv contains shell metacharacters")
    if any(token.startswith("--env") or "=" in token for token in argv):
        reasons.append("argv contains environment injection")
    return reasons


def state_template(mode: str, record: dict[str, Any] | None, artifact: dict[str, Any] | None, explicit_yes: bool, reason: str | None) -> dict[str, Any]:
    rollback = record["rollback"] if record else {"owner": None, "guidance_url": None, "quarantine_owned_only": True, "target_project_impact": 0}
    return {
        "schema_version": "1.0.0",
        "workflow_id": workflow_id(),
        "mode": mode,
        "installer_id": record["installer_id"] if record else None,
        "artifact": {
            "path": artifact.get("artifact_path") if artifact else None,
            "expected_sha256": artifact.get("expected_sha256") if artifact else None,
            "observed_sha256": artifact.get("observed_sha256") if artifact else None,
            "expected_size_bytes": artifact.get("expected_size_bytes") if artifact else None,
            "observed_size_bytes": artifact.get("observed_size_bytes") if artifact else None,
            "hash_status": artifact.get("hash_status") if artifact else "not-run",
            "path_owned": bool(artifact and artifact.get("path_owned")),
        },
        "approval": {
            "record_status": record["approval"]["status"] if record else "unknown",
            "explicit_yes": explicit_yes,
            "reason": redact_reason(reason),
            "exact_record": record is not None,
            "platform_match": bool(record and platform_matches(record)),
        },
        "preflight": {
            "status": "not-run",
            "read_only": True,
            "network": False,
            "shell": False,
            "elevated": False,
            "environment_variables": 0,
            "target_project_mutations": 0,
            "secrets_seen": False,
        },
        "execution": {
            "status": "not-run",
            "started": False,
            "finished": False,
            "commands_executed": 0,
            "exit_code": None,
            "timeout": False,
            "stdout_captured": False,
            "stderr_captured": False,
            "target_project_mutations": 0,
            "host_mutations": 0,
        },
        "authentication": {"status": "runtime-owned", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred", "secret_copy": False},
        "rollback": rollback,
        "updated_at": now(),
    }


def save_state(state: dict[str, Any]) -> None:
    atomic_json(STATE_PATH, {**state, "updated_at": now()})


def append_state_evidence(event: str, state: dict[str, Any], extra: dict[str, Any] | None = None) -> None:
    payload = {"installer_id": state.get("installer_id"), "mode": state.get("mode"), "status": state.get("execution", {}).get("status"), "hash_status": state.get("artifact", {}).get("hash_status"), "target_project_mutations": 0}
    if extra:
        payload.update(extra)
    append_evidence(event, payload)


def emit(report: dict[str, Any], as_json: bool, title: str) -> None:
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
        return
    print(f"\n{title}")
    for key, value in report.items():
        print(f"  {key}: {json.dumps(value, sort_keys=True) if isinstance(value, (dict, list)) else value}")


def plan(agent: str, as_json: bool) -> int:
    records = [record for record in load_records() if agent == "auto" or record["adapter_id"] == agent]
    items = []
    for record in records:
        blocked = validate_argv(record)
        if not platform_matches(record):
            blocked.append("record platform or architecture does not match this host")
        items.append({
            "installer_id": record["installer_id"],
            "adapter_id": record["adapter_id"],
            "display_name": record["display_name"],
            "platform": record["platform"],
            "architecture": record["architecture"],
            "artifact": record["artifact"],
            "provenance": record["provenance"],
            "approval_status": record["approval"]["status"],
            "execution": {"argv": record["execution"]["argv"], "network": record["execution"]["network"], "shell": record["execution"]["shell"], "elevated": record["execution"]["elevated"], "timeout_seconds": record["execution"]["timeout_seconds"]},
            "automatic_execution": "eligible-local-only" if not blocked and record["approval"]["status"] == "approved" else "blocked",
            "blocked_reasons": blocked + ([] if record["approval"]["status"] == "approved" else [f"record approval status is {record['approval']['status']}"]),
        })
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding execute-plan",
        "verdict": "pass",
        "agent": agent,
        "platform": current_platform(),
        "architecture": current_architecture(),
        "records": items,
        "eligible_installer_ids": [item["installer_id"] for item in items if item["automatic_execution"] == "eligible-local-only"],
        "network": "disabled",
        "mutations": 0,
        "commands_executed": 0,
        "raw_secret_values": 0,
        "target_project_mutations": 0,
        "authentication": "runtime-owned",
        "target_initialization": "deferred",
        "launch": "deferred",
    }
    emit(report, as_json, "O5 local execution plan")
    return 0


def hash_command(installer_id: str, requested_path: str | None, as_json: bool) -> int:
    record = find_record(installer_id)
    if record is None:
        report = {"verdict": "fail", "error_code": "O5-INSTALLER-UNKNOWN", "installer_id": installer_id, "raw_secret_values": 0}
        emit(report, as_json, "O5 artifact hash blocked")
        return 1
    artifact = hash_result(record, requested_path)
    state = state_template("hash", record, artifact, False, None)
    state["preflight"]["status"] = "passed" if artifact["hash_status"] == "passed" else "blocked"
    save_state(state)
    append_state_evidence("artifact-hash", state, {"observed_size_bytes": artifact["observed_size_bytes"]})
    report = {"schema_version": "1.0.0", "command": "aiw onboarding artifact-hash", "verdict": "pass" if artifact["hash_status"] == "passed" else "fail", "state_path": state_path_display(), **artifact}
    emit(report, as_json, "O5 artifact hash")
    return 0 if artifact["hash_status"] == "passed" else 1


def snapshot(root: Path) -> dict[str, tuple[int, int]]:
    result: dict[str, tuple[int, int]] = {}
    if not root.exists():
        return result
    for path in root.rglob("*"):
        if path.is_file() and not path.is_symlink():
            try:
                stat = path.stat()
                result[str(path.relative_to(root))] = (stat.st_size, stat.st_mtime_ns)
            except OSError:
                continue
    return result


def execute(installer_id: str, requested_path: str | None, reason: str | None, explicit_yes: bool, as_json: bool) -> int:
    record = find_record(installer_id)
    if record is None:
        report = {"verdict": "fail", "error_code": "O5-INSTALLER-UNKNOWN", "installer_id": installer_id, "commands_executed": 0, "raw_secret_values": 0}
        emit(report, as_json, "O5 execution blocked")
        return 1
    artifact = hash_result(record, requested_path)
    state = state_template("execute", record, artifact, explicit_yes, reason)
    reasons: list[str] = []
    if not explicit_yes:
        reasons.append("explicit --yes is required")
    if not reason or not reason.strip():
        reasons.append("approval reason is required")
    if record["approval"]["status"] != "approved":
        reasons.append(f"record approval status is {record['approval']['status']}")
    if not platform_matches(record):
        reasons.append("record platform or architecture does not match this host")
    if artifact["hash_status"] != "passed":
        reasons.extend(artifact["reasons"])
    reasons.extend(validate_argv(record))
    if reasons:
        state["preflight"]["status"] = "blocked"
        state["execution"]["status"] = "blocked"
        save_state(state)
        append_state_evidence("execution-blocked", state, {"reasons": reasons, "commands_executed": 0})
        report = {"schema_version": "1.0.0", "command": "aiw onboarding execute", "verdict": "fail", "error_code": "O5-EXECUTION-BLOCKED", "installer_id": installer_id, "blocked_reasons": reasons, "commands_executed": 0, "host_mutations": 0, "target_project_mutations": 0, "raw_secret_values": 0, "state_path": state_path_display()}
        emit(report, as_json, "O5 execution blocked")
        return 1
    state["preflight"]["status"] = "passed"
    argv = [artifact_path if token == "{artifact}" else token for token in record["execution"]["argv"] for artifact_path in [str((STAGING_ROOT / record["artifact"]["local_path"]).resolve())]]
    before = snapshot(STAGING_ROOT)
    state["execution"]["started"] = True
    state["execution"]["commands_executed"] = 1
    save_state(state)
    append_state_evidence("execution-started", state, {"argv_count": len(argv), "reason": redact_reason(reason)})
    try:
        completed = subprocess.run(argv, cwd=STAGING_ROOT, env={}, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False, timeout=record["execution"]["timeout_seconds"], check=False)
        state["execution"]["exit_code"] = completed.returncode
        state["execution"]["finished"] = True
        state["execution"]["status"] = "passed" if completed.returncode == 0 else "failed"
    except subprocess.TimeoutExpired:
        state["execution"]["finished"] = True
        state["execution"]["timeout"] = True
        state["execution"]["status"] = "timed-out"
    except OSError as exc:
        state["execution"]["finished"] = True
        state["execution"]["status"] = "failed"
        state["execution"]["exit_code"] = None
        state["execution"]["host_mutations"] = 0
        append_state_evidence("execution-error", state, {"error_type": type(exc).__name__})
    after = snapshot(STAGING_ROOT)
    changed = sorted(set(before) | set(after))
    state["execution"]["host_mutations"] = sum(1 for key in changed if before.get(key) != after.get(key))
    if state["execution"]["host_mutations"]:
        state["execution"]["status"] = "failed"
    save_state(state)
    append_state_evidence("execution-finished", state, {"exit_code": state["execution"]["exit_code"], "host_mutations": state["execution"]["host_mutations"], "commands_executed": 1})
    report = {"schema_version": "1.0.0", "command": "aiw onboarding execute", "verdict": "pass" if state["execution"]["status"] == "passed" else "fail", "installer_id": installer_id, "execution": state["execution"], "preflight": state["preflight"], "artifact": state["artifact"], "authentication": state["authentication"], "target": state["target"], "state_path": state_path_display(), "raw_secret_values": 0}
    emit(report, as_json, "O5 execution result")
    return 0 if report["verdict"] == "pass" else 1


def recover(reset_state: bool, as_json: bool) -> int:
    if reset_state:
        for path in (STATE_PATH, EVIDENCE_PATH):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        report = {"verdict": "pass", "recovered": True, "reset_state": True, "owned_paths_only": True, "staging_artifact_preserved": True, "runtime_changes": 0, "target_project_changes": 0}
        emit(report, as_json, "O5 state reset")
        return 0
    if not STATE_PATH.is_file():
        report = {"verdict": "pass", "recovered": False, "reason": "no O5 state exists", "owned_paths_only": True, "staging_artifact_preserved": True, "runtime_changes": 0, "target_project_changes": 0}
        emit(report, as_json, "O5 recovery")
        return 0
    try:
        state = load_json(STATE_PATH)
    except (OSError, json.JSONDecodeError):
        report = {"verdict": "fail", "error_code": "O5-STATE-CORRUPT", "owned_paths_only": True, "runtime_changes": 0, "target_project_changes": 0}
        emit(report, as_json, "O5 recovery blocked")
        return 1
    state["approval"]["explicit_yes"] = False
    state["execution"].update({"status": "not-run", "started": False, "finished": False, "commands_executed": 0, "exit_code": None, "timeout": False, "host_mutations": 0})
    save_state(state)
    append_state_evidence("recovered", state, {"runtime_changes": 0, "target_project_changes": 0})
    report = {"verdict": "pass", "recovered": True, "resumable": True, "state_path": state_path_display(), "owned_paths_only": True, "staging_artifact_preserved": True, "runtime_changes": 0, "target_project_changes": 0}
    emit(report, as_json, "O5 state recovered")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Workflow O5 digest-bound local artifact execution controls")
    sub = parser.add_subparsers(dest="command", required=True)
    plan_parser = sub.add_parser("execute-plan")
    plan_parser.add_argument("--agent", choices=["auto", "generic-command"], default="auto")
    plan_parser.add_argument("--json", action="store_true")
    hash_parser = sub.add_parser("artifact-hash")
    hash_parser.add_argument("--installer", required=True)
    hash_parser.add_argument("--path")
    hash_parser.add_argument("--json", action="store_true")
    execute_parser = sub.add_parser("execute")
    execute_parser.add_argument("--installer", required=True)
    execute_parser.add_argument("--path")
    execute_parser.add_argument("--reason")
    execute_parser.add_argument("--yes", action="store_true")
    execute_parser.add_argument("--json", action="store_true")
    recover_parser = sub.add_parser("recover")
    recover_parser.add_argument("--reset-state", action="store_true")
    recover_parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "execute-plan":
            return plan(args.agent, args.json)
        if args.command == "artifact-hash":
            return hash_command(args.installer, args.path, args.json)
        if args.command == "execute":
            return execute(args.installer, args.path, args.reason, args.yes, args.json)
        if args.command == "recover":
            return recover(args.reset_state, args.json)
        return 2
    except (OSError, RuntimeError, json.JSONDecodeError) as exc:
        report = {"verdict": "fail", "error_code": "O5-INTERNAL", "message": type(exc).__name__, "raw_secret_values": 0}
        print(json.dumps(report, indent=2) if getattr(args, "json", False) else f"O5 failure: {type(exc).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Onboarding O4: provenance-aware runtime installer planning and verification."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform as platform_module
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
POLICY_PATH = CONFIG / "onboarding-o4-policy.json"
CATALOG_PATH = CONFIG / "runtime-installer-catalog.json"
ADAPTER_CATALOG_PATH = CONFIG / "agent-runtime-catalog.json"
STATE_ROOT = Path(os.environ.get("AIW_O4_STATE_ROOT", str(ROOT / ".aiw" / "onboarding-o4")))
STATE_PATH = STATE_ROOT / "state.json"
EVIDENCE_PATH = STATE_ROOT / "evidence.jsonl"
VERSION_RE = re.compile(r"(?<!\d)(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?")
FORBIDDEN_TOKEN_RE = re.compile(r"[;&|<>$`\n\r]")


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


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
    safe_payload = dict(payload)
    safe_payload["raw_secret_values"] = 0
    with EVIDENCE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": now(), "event": event, **safe_payload}, sort_keys=True) + "\n")


def load_policy() -> dict[str, Any]:
    return load_json(POLICY_PATH)


def load_records() -> list[dict[str, Any]]:
    return load_json(CATALOG_PATH)["records"]


def load_adapters() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in load_json(ADAPTER_CATALOG_PATH)["adapters"]}


def current_platform() -> str:
    override = os.environ.get("AIW_O4_PLATFORM", "").strip().lower()
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
    override = os.environ.get("AIW_O4_ARCH", "").strip().lower()
    if override in {"x64", "arm64"}:
        return override
    machine = platform_module.machine().lower()
    if machine in {"aarch64", "arm64"}:
        return "arm64"
    if machine in {"x86_64", "amd64", "x64"}:
        return "x64"
    return "unknown"


def current_shell() -> str:
    override = os.environ.get("AIW_O4_SHELL", "").strip().lower()
    if override in {"bash", "zsh", "powershell", "cmd", "any"}:
        return override
    if current_platform() == "windows":
        return "powershell" if os.environ.get("PSModulePath") else "cmd"
    shell = Path(os.environ.get("SHELL", "")).name.lower()
    return shell if shell in {"bash", "zsh"} else "any"


def redact_command(command: str) -> str:
    return re.sub(r"(?i)(api[_-]?key|token|secret|password)=\S+", r"\1=<redacted>", command)


def command_is_safe_for_display(record: dict[str, Any]) -> bool:
    command = record["command"]["display"]
    return not FORBIDDEN_TOKEN_RE.search(command) or record["command"]["pipe_to_shell"] is True


def command_policy_reasons(record: dict[str, Any], policy: dict[str, Any]) -> list[str]:
    command = record["command"]
    reasons: list[str] = []
    if record["review"]["status"] != "verified":
        reasons.append("record review status is not verified")
    if command["execution_status"] != "eligible":
        reasons.append(f"record execution status is {command['execution_status']}")
    if command["pipe_to_shell"] and not policy["execution"]["pipe_to_shell_allowed"]:
        reasons.append("shell pipeline execution is forbidden")
    if command["elevated"] and not policy["execution"]["elevated_allowed"]:
        reasons.append("elevated command execution is forbidden")
    if command["network"] and not policy["execution"]["network_downloads_allowed"]:
        reasons.append("network downloads are forbidden")
    if record["channel"] in {"npm", "homebrew", "winget"} and not policy["execution"]["package_manager_mutation_allowed"]:
        reasons.append("package-manager mutation is forbidden")
    if record["channel"] == "docker" and not policy["execution"]["docker_mutation_allowed"]:
        reasons.append("Docker mutation is forbidden")
    if record["provenance"]["source_kind"] not in {"official-documentation", "official-package-registry", "official-release"}:
        reasons.append("provenance is not official")
    if not record["provenance"]["source_fingerprint"].startswith("sha256:"):
        reasons.append("source fingerprint is missing")
    return reasons


def matches(record: dict[str, Any], platform_name: str, architecture: str, shell: str, agent: str) -> bool:
    if agent != "auto" and record["adapter_id"] != agent:
        return False
    return (
        record["platform"] == platform_name
        and record["architecture"] in {architecture, "any"}
        and record["shell"] in {shell, "any"}
    )


def filtered_records(agent: str, platform_name: str | None = None, architecture: str | None = None, shell: str | None = None) -> list[dict[str, Any]]:
    platform_name = platform_name or current_platform()
    architecture = architecture or current_architecture()
    shell = shell or current_shell()
    return [record for record in load_records() if matches(record, platform_name, architecture, shell, agent)]


def version_from_output(output: str) -> str | None:
    match = VERSION_RE.search(output[:512])
    return match.group(0) if match else None


def executable_for_adapter(adapter_id: str) -> str | None:
    adapter = load_adapters().get(adapter_id)
    if not adapter:
        return None
    executable = adapter["detection"]["executable"]
    if executable == "user-defined":
        executable = os.environ.get("AIW_AGENT_COMMAND", "").strip()
    if not executable or FORBIDDEN_TOKEN_RE.search(executable):
        return None
    return shutil.which(executable) or (executable if Path(executable).is_file() else None)


def safe_probe(record: dict[str, Any]) -> dict[str, Any]:
    executable = executable_for_adapter(record["adapter_id"])
    result: dict[str, Any] = {
        "installer_id": record["installer_id"],
        "adapter_id": record["adapter_id"],
        "available": False,
        "executable_found": bool(executable),
        "version": None,
        "version_probe": "not-run",
        "doctor_probe": "not-defined",
        "read_only": True,
        "external_writes": 0,
        "secrets_seen": False,
        "reason": "executable not found",
    }
    if not executable:
        return result
    verification = record["verification"]
    version_argv = verification["version_argv"]
    if not version_argv or version_argv[0] != record["adapter_id"] and version_argv[0] != Path(executable).name:
        result["version_probe"] = "blocked"
        result["reason"] = "verification executable mismatch"
        return result
    command = [executable, *version_argv[1:]]
    try:
        completed = subprocess.run(command, cwd=ROOT, env={"PATH": os.environ.get("PATH", "")}, capture_output=True, text=True, timeout=verification["timeout_seconds"], check=False)
    except (OSError, subprocess.SubprocessError) as exc:
        result["version_probe"] = "error"
        result["reason"] = type(exc).__name__
        return result
    result["version_probe"] = "passed" if completed.returncode == 0 else "failed"
    result["version"] = version_from_output((completed.stdout + " " + completed.stderr).strip())
    if completed.returncode == 0 and result["version"]:
        result["available"] = True
        result["reason"] = "safe version probe passed"
    else:
        result["reason"] = "version probe failed or returned no version"
    doctor_argv = verification.get("doctor_argv", [])
    if doctor_argv:
        if any(FORBIDDEN_TOKEN_RE.search(token) for token in doctor_argv):
            result["doctor_probe"] = "blocked"
        else:
            doctor_command = [executable, *doctor_argv[1:]] if doctor_argv[0] in {record["adapter_id"], Path(executable).name} else [executable, *doctor_argv]
            try:
                doctor = subprocess.run(doctor_command, cwd=ROOT, env={"PATH": os.environ.get("PATH", "")}, capture_output=True, text=True, timeout=verification["timeout_seconds"], check=False)
                result["doctor_probe"] = "passed" if doctor.returncode == 0 else "failed"
            except (OSError, subprocess.SubprocessError):
                result["doctor_probe"] = "error"
    return result


def initial_state(mode: str, installer_id: str | None, explicit_yes: bool, record: dict[str, Any] | None) -> dict[str, Any]:
    rollback = record["rollback"] if record else {"owner": None, "supported": False, "guidance_url": None, "target_project_impact": 0}
    return {
        "schema_version": "1.0.0",
        "workflow_id": workflow_id(),
        "mode": mode,
        "installer_id": installer_id,
        "consent": {"requested": mode in {"install", "resume"}, "explicit_yes": explicit_yes, "record_exact_match": record is not None, "raw_secret_allowed": False},
        "verification": {"status": "not-run", "version": None, "doctor_status": "not-run", "read_only": True, "external_writes": 0, "secrets_seen": False},
        "installation": {"status": "not-run", "commands_executed": 0, "network_commands": 0, "host_mutations": 0, "target_project_mutations": 0},
        "authentication": {"status": "runtime-owned", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred"},
        "rollback": rollback,
        "updated_at": now(),
    }


def save_state(state: dict[str, Any]) -> None:
    atomic_json(STATE_PATH, {**state, "updated_at": now()})


def load_state() -> dict[str, Any] | None:
    if not STATE_PATH.is_file():
        return None
    try:
        state = load_json(STATE_PATH)
    except (OSError, json.JSONDecodeError):
        raise RuntimeError("O4-STATE-CORRUPT: O4 state is unreadable; run `aiw onboarding recover --o4 --reset-state`")
    if state.get("schema_version") != "1.0.0" or state.get("workflow_id") != workflow_id():
        raise RuntimeError("O4-STATE-UNKNOWN: O4 state belongs to an unknown schema or workflow")
    return state


def emit(value: Any, as_json: bool, title: str | None = None) -> None:
    if as_json:
        print(json.dumps(value, indent=2, sort_keys=True))
        return
    if title:
        print(f"\n{title}")
    if isinstance(value, dict):
        for key, item in value.items():
            print(f"  {key}: {json.dumps(item, sort_keys=True) if isinstance(item, (dict, list)) else item}")
    else:
        print(value)


def plan(agent: str, platform_name: str | None, architecture: str | None, shell: str | None, as_json: bool) -> int:
    policy = load_policy()
    actual_platform = platform_name or current_platform()
    actual_architecture = architecture or current_architecture()
    actual_shell = shell or current_shell()
    records = filtered_records(agent, actual_platform, actual_architecture, actual_shell)
    items = []
    for record in records:
        reasons = command_policy_reasons(record, policy)
        items.append({
            "installer_id": record["installer_id"],
            "adapter_id": record["adapter_id"],
            "display_name": record["display_name"],
            "platform": record["platform"],
            "architecture": record["architecture"],
            "shell": record["shell"],
            "channel": record["channel"],
            "command": redact_command(record["command"]["display"]),
            "provenance": {"official_url": record["provenance"]["official_url"], "source_kind": record["provenance"]["source_kind"], "retrieved_at": record["provenance"]["retrieved_at"], "source_fingerprint": record["provenance"]["source_fingerprint"]},
            "review_status": record["review"]["status"],
            "verification": record["verification"],
            "rollback": record["rollback"],
            "automatic_execution": "eligible" if not reasons else "blocked",
            "blocked_reasons": reasons,
        })
    eligible = [item["installer_id"] for item in items if item["automatic_execution"] == "eligible"]
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding install-plan",
        "verdict": "pass",
        "agent": agent,
        "platform": actual_platform,
        "architecture": actual_architecture,
        "shell": actual_shell,
        "records": items,
        "eligible_installer_ids": eligible,
        "manual_only_installer_count": len(items) - len(eligible),
        "network": policy["planning"]["network"],
        "mutations": policy["planning"]["mutations"],
        "commands_executed": policy["planning"]["commands_executed"],
        "raw_secret_values": policy["planning"]["raw_secret_values"],
        "target_project_mutations": policy["execution"]["target_project_mutations"],
        "authentication": "runtime-owned",
        "target_initialization": "deferred",
        "launch": "deferred",
    }
    emit(report, as_json, "O4 installer plan")
    return 0


def verify(agent: str, platform_name: str | None, architecture: str | None, shell: str | None, as_json: bool) -> int:
    if agent == "auto":
        report = {"verdict": "fail", "error_code": "O4-AGENT-REQUIRED", "message": "install verification requires an exact adapter id", "external_writes": 0, "raw_secret_values": 0}
        emit(report, as_json, "O4 verification blocked")
        return 1
    records = filtered_records(agent, platform_name, architecture, shell)
    if not records:
        report = {"verdict": "fail", "error_code": "O4-NO-INSTALLER-RECORD", "agent": agent, "external_writes": 0, "raw_secret_values": 0}
        emit(report, as_json, "O4 verification blocked")
        return 1
    probe = safe_probe(records[0])
    state = initial_state("verify", records[0]["installer_id"], False, records[0])
    state["verification"].update({"status": "passed" if probe["available"] else "warned", "version": probe["version"], "doctor_status": probe["doctor_probe"]})
    save_state(state)
    append_evidence("install-verification", {"installer_id": records[0]["installer_id"], "adapter_id": agent, "available": probe["available"], "external_writes": 0})
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding install-verify",
        "verdict": "pass" if probe["available"] else "warn",
        "installer_id": records[0]["installer_id"],
        "adapter_id": agent,
        "probe": probe,
        "state_path": state_path_display(),
        "installation": {"status": "not-run", "commands_executed": 0, "network_commands": 0, "host_mutations": 0, "target_project_mutations": 0},
        "authentication": {"status": "runtime-owned", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred"},
    }
    emit(report, as_json, "O4 install verification")
    return 0 if probe["available"] else 1


def install(installer_id: str, explicit_yes: bool, as_json: bool) -> int:
    policy = load_policy()
    record = next((item for item in load_records() if item["installer_id"] == installer_id), None)
    if not explicit_yes:
        report = {"verdict": "fail", "error_code": "O4-CONSENT-REQUIRED", "message": "install requires explicit --yes; no installer command was executed", "installer_id": installer_id, "commands_executed": 0, "host_mutations": 0, "target_project_mutations": 0, "raw_secret_values": 0}
        emit(report, as_json, "O4 install blocked")
        return 1
    if record is None:
        report = {"verdict": "fail", "error_code": "O4-INSTALLER-UNKNOWN", "message": "exact installer record was not found; no fallback is permitted", "installer_id": installer_id, "commands_executed": 0, "host_mutations": 0, "target_project_mutations": 0, "raw_secret_values": 0}
        emit(report, as_json, "O4 install blocked")
        return 1
    reasons = command_policy_reasons(record, policy)
    state = initial_state("install", installer_id, True, record)
    state["installation"].update({"status": "blocked" if reasons else "eligible"})
    save_state(state)
    append_evidence("install-blocked", {"installer_id": installer_id, "reasons": reasons, "commands_executed": 0, "host_mutations": 0, "target_project_mutations": 0})
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding install",
        "verdict": "fail" if reasons else "deferred",
        "error_code": "O4-INSTALL-NOT-ELIGIBLE" if reasons else None,
        "installer_id": installer_id,
        "automatic_execution": "blocked" if reasons else "eligible",
        "blocked_reasons": reasons,
        "commands_executed": 0,
        "network_commands": 0,
        "host_mutations": 0,
        "target_project_mutations": 0,
        "raw_secret_values": 0,
        "authentication": "runtime-owned",
        "target_initialization": "deferred",
        "launch": "deferred",
        "state_path": state_path_display(),
    }
    emit(report, as_json, "O4 install blocked" if reasons else "O4 install deferred")
    return 1 if reasons else 0


def recover(reset_state: bool, as_json: bool) -> int:
    state = load_state()
    if state is None:
        report = {"verdict": "pass", "recovered": False, "reason": "no O4 state exists", "owned_paths_only": True, "runtime_changes": 0, "target_project_changes": 0}
        emit(report, as_json, "O4 recovery")
        return 0
    if reset_state:
        if STATE_ROOT.exists():
            import shutil as _shutil
            _shutil.rmtree(STATE_ROOT)
        report = {"verdict": "pass", "recovered": True, "reset_state": True, "owned_paths_only": True, "runtime_changes": 0, "target_project_changes": 0}
        emit(report, as_json, "O4 state reset")
        return 0
    state["consent"]["explicit_yes"] = False
    state["installation"].update({"status": "not-run", "commands_executed": 0, "network_commands": 0, "host_mutations": 0, "target_project_mutations": 0})
    save_state(state)
    append_evidence("recovered", {"installer_id": state.get("installer_id"), "owned_paths_only": True, "runtime_changes": 0, "target_project_changes": 0})
    report = {"verdict": "pass", "recovered": True, "resumable": True, "state_path": state_path_display(), "owned_paths_only": True, "runtime_changes": 0, "target_project_changes": 0}
    emit(report, as_json, "O4 state recovered")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Workflow O4 verified agent-neutral runtime installation controls")
    sub = parser.add_subparsers(dest="command", required=True)
    plan_parser = sub.add_parser("install-plan")
    plan_parser.add_argument("--agent", choices=["auto", "opencode", "claude-code", "codex", "generic-command"], default="auto")
    plan_parser.add_argument("--platform", choices=["linux", "macos", "windows"])
    plan_parser.add_argument("--architecture", choices=["x64", "arm64"])
    plan_parser.add_argument("--shell", choices=["bash", "zsh", "powershell", "cmd", "any"])
    plan_parser.add_argument("--json", action="store_true")
    verify_parser = sub.add_parser("install-verify")
    verify_parser.add_argument("--agent", choices=["opencode", "claude-code", "codex", "generic-command"], required=True)
    verify_parser.add_argument("--platform", choices=["linux", "macos", "windows"])
    verify_parser.add_argument("--architecture", choices=["x64", "arm64"])
    verify_parser.add_argument("--shell", choices=["bash", "zsh", "powershell", "cmd", "any"])
    verify_parser.add_argument("--json", action="store_true")
    install_parser = sub.add_parser("install")
    install_parser.add_argument("--installer", required=True)
    install_parser.add_argument("--yes", action="store_true")
    install_parser.add_argument("--json", action="store_true")
    recover_parser = sub.add_parser("recover")
    recover_parser.add_argument("--reset-state", action="store_true")
    recover_parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "install-plan":
            return plan(args.agent, args.platform, args.architecture, args.shell, args.json)
        if args.command == "install-verify":
            return verify(args.agent, args.platform, args.architecture, args.shell, args.json)
        if args.command == "install":
            return install(args.installer, args.yes, args.json)
        if args.command == "recover":
            return recover(args.reset_state, args.json)
        return 2
    except RuntimeError as exc:
        report = {"verdict": "fail", "error_code": str(exc).split(":", 1)[0], "message": str(exc), "raw_secret_values": 0}
        print(json.dumps(report, indent=2) if getattr(args, "json", False) else f"O4 failure: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

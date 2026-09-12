"""Onboarding O7: vendor-neutral verifier adapters and optional evidence refresh."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
POLICY_PATH = CONFIG / "onboarding-o7-policy.json"
CATALOG_PATH = CONFIG / "verifier-adapter-o7-catalog.json"
STATE_ROOT = Path(os.environ.get("AIW_O7_STATE_ROOT", str(ROOT / ".aiw" / "onboarding-o7")))
STATE_PATH = STATE_ROOT / "state.json"
EVIDENCE_PATH = STATE_ROOT / "evidence.jsonl"
O5_STAGING_ROOT = Path(os.environ.get("AIW_O5_STAGING_ROOT", str(ROOT / ".aiw" / "onboarding-o5" / "staging")))


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value: dict[str, Any]) -> None:
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


def workflow_id() -> str:
    return hashlib.sha256(str(ROOT.resolve()).encode("utf-8")).hexdigest()[:32]


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def sha256_bytes(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def append_evidence(event: str, payload: dict[str, Any]) -> None:
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    safe = dict(payload)
    safe.pop("response_body", None)
    safe.pop("stdout", None)
    safe.pop("stderr", None)
    safe["raw_secret_values"] = 0
    with EVIDENCE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": now(), "event": event, **safe}, sort_keys=True) + "\n")


def load_policy() -> dict[str, Any]:
    return load_json(POLICY_PATH)


def load_records() -> list[dict[str, Any]]:
    return load_json(CATALOG_PATH)["records"]


def find_record(adapter_id: str) -> dict[str, Any] | None:
    return next((record for record in load_records() if record["adapter_id"] == adapter_id), None)


def state_template(mode: str, record: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "workflow_id": workflow_id(),
        "mode": mode,
        "adapter_id": record["adapter_id"] if record else None,
        "artifact": {"path": None, "expected_sha256": None, "observed_sha256": None, "subject_match": False},
        "network": {"requested": False, "consent": False, "performed": False, "allowed_hosts": record["network"]["allowed_hosts"] if record else [], "requests": 0, "response_bytes": 0, "timeout_seconds": record["network"]["timeout_seconds"] if record else 0},
        "verification": {"mode": "not-run", "tool_status": "not-run", "bundle_present": False, "trust_root_present": False, "signature_valid": False, "claims_valid": False, "offline_result": "not-run", "online_result": "not-run"},
        "refresh": {"candidate_path": None, "candidate_sha256": None, "source_url": None, "source_host": None, "accepted": False, "active_root_overwritten": False, "stale_root_warning": False},
        "evidence": {"record_path": None, "response_digest": None, "raw_secret_values": 0, "redacted": True, "source_provenance": "none"},
        "policy": {"verdict": "blocked", "fail_closed": True, "reasons": []},
        "authentication": {"status": "runtime-owned", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred", "secret_copy": False},
        "updated_at": now(),
    }


def save_state(state: dict[str, Any]) -> None:
    save_json(STATE_PATH, {**state, "updated_at": now()})


def safe_artifact(path_text: str) -> tuple[Path | None, list[str]]:
    path = Path(path_text).expanduser()
    reasons: list[str] = []
    try:
        root = O5_STAGING_ROOT.resolve(strict=False)
        resolved = path.resolve(strict=False)
        resolved.relative_to(root)
    except (OSError, ValueError):
        return None, ["artifact is outside the O5 staging root"]
    if path.is_symlink():
        reasons.append("artifact symlink is forbidden")
    if not resolved.is_file():
        reasons.append("artifact file is missing")
    return (resolved if not reasons else None), reasons


def expand_argv(template: list[str], artifact: str, record: dict[str, Any], network: bool = False) -> list[str]:
    replacements = {
        "{artifact}": artifact,
        "{bundle}": "<local-bundle>",
        "{trusted_root}": "<local-trusted-root>",
        "{repository}": "<expected-repository>",
        "{predicate_type}": "https://slsa.dev/provenance/v1",
        "{identity}": "<expected-identity>",
        "{issuer}": "<expected-issuer>",
    }
    return [replacements.get(item, item) for item in template]


def run_local_fixture_delegate(artifact: Path) -> tuple[dict[str, Any], str]:
    delegate_state = STATE_ROOT / "delegate-o6"
    delegate_env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "AIW_O6_STATE_ROOT": str(delegate_state), "AIW_O5_STAGING_ROOT": str(O5_STAGING_ROOT)}
    result = subprocess.run([sys.executable, str(ROOT / "scripts/onboarding-o6.py"), "attestation-verify", "--attestation", "O6-CONTROLLED-FIXTURE", "--artifact", str(artifact), "--json"], cwd=ROOT, env=delegate_env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30, check=False)
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        report = {"verdict": "fail", "error_code": "O7-DELEGATE-OUTPUT", "raw_secret_values": 0}
    return report, result.stderr


def verify_external(record: dict[str, Any], artifact: Path, allow_network: bool) -> tuple[dict[str, Any], list[str]]:
    reasons: list[str] = []
    modes = record["verification_modes"]
    if "offline-bundle" not in modes and "offline-key" not in modes:
        reasons.append("adapter has no offline verification mode")
        if not allow_network:
            reasons.append("online verification requires explicit refresh/verification consent")
        return {"tool_status": "blocked", "offline_result": "not-run", "online_result": "not-run"}, reasons
    executable = shutil.which(record["executable"])
    if not executable:
        return {"tool_status": "missing", "offline_result": "fail", "online_result": "not-run"}, [f"verifier executable is unavailable: {record['executable']}"]
    argv = expand_argv(record["argv_template"], str(artifact), record, network=allow_network)
    if not allow_network and any(mode.startswith("online") for mode in modes) and not any(mode.startswith("offline") for mode in modes):
        return {"tool_status": "blocked", "offline_result": "not-run", "online_result": "not-run"}, ["network verification is disabled by default"]
    try:
        result = subprocess.run([executable, *argv[1:]], cwd=ROOT, env={}, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=record["network"]["timeout_seconds"], check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"tool_status": "available", "offline_result": "fail", "online_result": "fail" if allow_network else "not-run"}, [f"verifier invocation failed: {type(exc).__name__}"]
    if result.returncode != 0:
        reasons.append("verifier returned a non-zero exit status")
    try:
        output = json.loads(result.stdout) if result.stdout.strip() else {}
    except json.JSONDecodeError:
        output = {}
        reasons.append("verifier output was not valid JSON")
    claims_valid = bool(output) and not reasons
    return {"tool_status": "available", "offline_result": "pass" if claims_valid and not allow_network else "fail" if not allow_network else "not-run", "online_result": "pass" if claims_valid and allow_network else "fail" if allow_network else "not-run", "claims_valid": claims_valid}, reasons


def plan(adapter_id: str, as_json: bool) -> int:
    records = load_records()
    if adapter_id != "auto":
        records = [record for record in records if record["adapter_id"] == adapter_id]
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding verifier-plan",
        "verdict": "pass" if records else "fail",
        "records": [
            {
                "adapter_id": record["adapter_id"],
                "vendor": record["vendor"],
                "kind": record["kind"],
                "verification_modes": record["verification_modes"],
                "offline_default": "offline-bundle" in record["verification_modes"] or "offline-key" in record["verification_modes"],
                "network_default": record["network"]["default"],
                "network_refresh_opt_in": record["network"]["refresh_opt_in"],
                "allowed_hosts": record["network"]["allowed_hosts"],
                "candidate_root_path": record["network"]["candidate_root_path"],
                "active_root_overwrite": record["network"]["active_root_overwrite"],
                "claims": record["claim_requirements"],
                "installation_authorized": record["authority"]["installation"],
                "execution_authorized": record["authority"]["execution"],
                "authentication": record["authority"]["authentication"],
                "target_project_mutations": record["authority"]["target_mutations"],
                "launch": record["authority"]["launch"],
                "blocked_reasons": ["verifier tools are manual-only", "network is disabled by default", "active trust roots cannot be overwritten", "runtime installation and execution are not authorized"],
            }
            for record in records
        ],
        "network": "disabled",
        "requests": 0,
        "response_bytes": 0,
        "raw_secret_values": 0,
    }
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print("\nO7 verifier adapter plan")
        for record in report["records"]:
            print(f"  {record['adapter_id']}: {record['kind']} · offline={record['offline_default']} · network=disabled")
    return 0 if report["verdict"] == "pass" else 1


def verify(adapter_id: str, artifact_text: str, allow_network: bool, as_json: bool) -> int:
    record = find_record(adapter_id)
    state = state_template("verify", record)
    reasons: list[str] = []
    if record is None:
        reasons.append("unknown verifier adapter")
    artifact, path_reasons = safe_artifact(artifact_text)
    reasons.extend(path_reasons)
    if artifact is not None:
        state["artifact"]["path"] = display_path(artifact)
        state["artifact"]["observed_sha256"] = sha256_file(artifact)
        state["artifact"]["subject_match"] = True
    if record and record["kind"] == "local-fixture" and artifact is not None:
        state["verification"]["mode"] = "offline-bundle"
        state["verification"]["tool_status"] = "available"
        delegate_report, delegate_stderr = run_local_fixture_delegate(artifact)
        state["verification"]["bundle_present"] = delegate_report.get("signature", {}).get("bundle_present", False)
        state["verification"]["trust_root_present"] = delegate_report.get("trust", {}).get("root_present", False)
        state["verification"]["signature_valid"] = delegate_report.get("signature", {}).get("signature_valid", False)
        state["verification"]["claims_valid"] = all(delegate_report.get("claims", {}).get(key, False) for key in ["identity_match", "builder_match", "repository_match", "commit_match", "build_type_match", "predicate_match", "external_parameters_match"])
        state["verification"]["offline_result"] = "pass" if delegate_report.get("verdict") == "pass" else "fail"
        state["evidence"]["record_path"] = "config/attestations/o6/controlled-fixture-attestation.json"
        state["evidence"]["response_digest"] = sha256_file(ROOT / "config/attestations/o6/controlled-fixture-attestation.json")
        state["evidence"]["source_provenance"] = "local"
        if delegate_report.get("verdict") != "pass":
            reasons.append("O6 local attestation delegate failed")
        if delegate_stderr:
            reasons.append("local verifier emitted diagnostic stderr")
    elif record and artifact is not None:
        state["network"]["requested"] = allow_network
        state["network"]["consent"] = allow_network
        external_report, external_reasons = verify_external(record, artifact, allow_network)
        reasons.extend(external_reasons)
        state["verification"].update({key: value for key, value in external_report.items() if key in state["verification"]})
        state["verification"]["mode"] = "online-registry" if "online-registry" in record["verification_modes"] and allow_network else "offline-bundle" if not allow_network else "online-api"
        if not allow_network and "offline-bundle" not in record["verification_modes"] and "offline-key" not in record["verification_modes"]:
            state["policy"]["reasons"].append("adapter requires online verification; run explicit refresh command")
    if allow_network and record:
        state["network"]["requested"] = True
        state["network"]["consent"] = True
        reasons.append("direct network verification is not activated by O7; use verifier-refresh for evidence acquisition")
    if reasons:
        state["policy"]["verdict"] = "fail"
        state["policy"]["reasons"] = sorted(set(reasons))
    else:
        state["policy"]["verdict"] = "pass"
    save_state(state)
    append_evidence("verifier-verify", {"adapter_id": adapter_id, "verdict": state["policy"]["verdict"], "mode": state["verification"]["mode"], "network": state["network"]["performed"], "response_digest": state["evidence"]["response_digest"]})
    report = {"schema_version": "1.0.0", "command": "aiw onboarding verifier-verify", "verdict": state["policy"]["verdict"], "adapter_id": adapter_id, "artifact": state["artifact"], "network": state["network"], "verification": state["verification"], "evidence": state["evidence"], "policy": state["policy"], "authentication": state["authentication"], "target": state["target"], "installation_authorized": False, "execution_authorized": False, "raw_secret_values": 0}
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"O7 verifier result: {report['verdict']} ({adapter_id})")
        for reason in report["policy"]["reasons"]:
            print(f"  reason: {reason}")
    return 0 if report["verdict"] == "pass" else 1


def refresh_plan(adapter_id: str, as_json: bool) -> int:
    record = find_record(adapter_id)
    if record is None:
        report = {"command": "aiw onboarding verifier-refresh-plan", "verdict": "fail", "error_code": "O7-ADAPTER-UNKNOWN", "raw_secret_values": 0}
        if as_json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print("O7 refresh plan blocked: unknown adapter", file=sys.stderr)
        return 1
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding verifier-refresh-plan",
        "verdict": "pass",
        "adapter_id": adapter_id,
        "vendor": record["vendor"],
        "allowed_hosts": record["network"]["allowed_hosts"],
        "default_network": record["network"]["default"],
        "refresh_opt_in": record["network"]["refresh_opt_in"],
        "consent_flag": "--yes",
        "timeout_seconds": record["network"]["timeout_seconds"],
        "max_response_bytes": record["network"]["max_response_bytes"],
        "candidate_root_path": record["network"]["candidate_root_path"],
        "active_root_overwrite": False,
        "source_digest_required": True,
        "evidence_required": True,
        "requests": 0,
        "response_bytes": 0,
        "installation_authorized": False,
        "execution_authorized": False,
        "authentication": "deferred",
        "target_project_mutations": 0,
        "launch": "deferred",
        "raw_secret_values": 0,
    }
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"O7 refresh plan: {adapter_id} · network disabled by default · active root overwrite blocked")
    return 0


class AllowlistedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: set[str]):
        super().__init__()
        self.allowed_hosts = allowed_hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        host = urllib.parse.urlparse(newurl).hostname
        if host not in self.allowed_hosts:
            raise urllib.error.URLError("redirect host is not allowlisted")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def refresh(adapter_id: str, source_url: str, yes: bool, as_json: bool) -> int:
    record = find_record(adapter_id)
    if record is None:
        report = {"command": "aiw onboarding verifier-refresh", "verdict": "fail", "error_code": "O7-ADAPTER-UNKNOWN", "raw_secret_values": 0}
        if as_json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print("O7 refresh blocked: unknown adapter", file=sys.stderr)
        return 1
    if not yes:
        report = {"command": "aiw onboarding verifier-refresh", "verdict": "fail", "error_code": "O7-CONSENT-REQUIRED", "reason": "explicit --yes is required; plan first", "network": False, "active_root_overwritten": False, "raw_secret_values": 0}
        if as_json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print("O7 refresh blocked: explicit --yes is required", file=sys.stderr)
        return 1
    parsed = urllib.parse.urlparse(source_url)
    allowed = set(record["network"]["allowed_hosts"])
    if parsed.scheme != "https" or parsed.hostname not in allowed:
        report = {"command": "aiw onboarding verifier-refresh", "verdict": "fail", "error_code": "O7-HOST-NOT-ALLOWLISTED", "source_host": parsed.hostname, "allowed_hosts": sorted(allowed), "network": False, "active_root_overwritten": False, "raw_secret_values": 0}
        if as_json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print("O7 refresh blocked: source host is not allowlisted", file=sys.stderr)
        return 1
    state = state_template("refresh", record)
    state["network"].update({"requested": True, "consent": True})
    state["refresh"].update({"source_url": source_url, "source_host": parsed.hostname})
    try:
        opener = urllib.request.build_opener(AllowlistedRedirectHandler(allowed))
        request = urllib.request.Request(source_url, headers={"User-Agent": "AI-Workflow-O7-verifier/1.0", "Accept": "application/json"}, method="GET")
        with opener.open(request, timeout=record["network"]["timeout_seconds"]) as response:
            chunks: list[bytes] = []
            total = 0
            while True:
                chunk = response.read(min(65536, record["network"]["max_response_bytes"] - total))
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
                if total >= record["network"]["max_response_bytes"]:
                    raise RuntimeError("response exceeded O7 byte budget")
        body = b"".join(chunks)
        digest = sha256_bytes(body)
        candidate_dir = STATE_ROOT / "candidates"
        candidate_dir.mkdir(parents=True, exist_ok=True)
        candidate_path = candidate_dir / f"{adapter_id.lower()}.candidate"
        candidate_path.write_bytes(body)
        state["network"].update({"performed": True, "requests": 1, "response_bytes": len(body)})
        state["refresh"].update({"candidate_path": display_path(candidate_path), "candidate_sha256": digest, "accepted": False, "active_root_overwritten": False})
        state["evidence"].update({"record_path": display_path(candidate_path), "response_digest": digest, "source_provenance": "network-refresh"})
        state["policy"].update({"verdict": "pass", "reasons": ["candidate evidence written; active trust root remains unchanged"]})
    except (OSError, urllib.error.URLError, TimeoutError, RuntimeError) as exc:
        state["policy"].update({"verdict": "fail", "reasons": [f"bounded refresh failed: {type(exc).__name__}"]})
    save_state(state)
    append_evidence("verifier-refresh", {"adapter_id": adapter_id, "verdict": state["policy"]["verdict"], "network": state["network"]["performed"], "requests": state["network"]["requests"], "response_bytes": state["network"]["response_bytes"], "source_url": source_url, "response_digest": state["evidence"]["response_digest"]})
    report = {"schema_version": "1.0.0", "command": "aiw onboarding verifier-refresh", "verdict": state["policy"]["verdict"], "adapter_id": adapter_id, "network": state["network"], "refresh": state["refresh"], "evidence": state["evidence"], "policy": state["policy"], "active_root_overwritten": False, "installation_authorized": False, "execution_authorized": False, "authentication": state["authentication"], "target": state["target"], "raw_secret_values": 0}
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"O7 refresh result: {report['verdict']} ({adapter_id})")
    return 0 if report["verdict"] == "pass" else 1


def recover(reset_state: bool, as_json: bool) -> int:
    if reset_state:
        for path in (STATE_PATH, EVIDENCE_PATH):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        report = {"command": "aiw onboarding recover --o7", "verdict": "pass", "recovered": True, "reset_state": True, "owned_paths_only": True, "candidate_preserved": True, "active_root_untouched": True, "target_project_changes": 0, "runtime_changes": 0, "raw_secret_values": 0}
    else:
        report = {"command": "aiw onboarding recover --o7", "verdict": "pass", "recovered": STATE_PATH.exists(), "owned_paths_only": True, "candidate_preserved": True, "active_root_untouched": True, "target_project_changes": 0, "runtime_changes": 0, "raw_secret_values": 0}
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print("O7 recovery: " + ("owned state reset" if reset_state else "no state changed"))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Workflow O7 vendor-neutral verifier adapters")
    sub = parser.add_subparsers(dest="command", required=True)
    plan_parser = sub.add_parser("verifier-plan")
    plan_parser.add_argument("--adapter", default="auto")
    plan_parser.add_argument("--json", action="store_true")
    verify_parser = sub.add_parser("verifier-verify")
    verify_parser.add_argument("--adapter", required=True)
    verify_parser.add_argument("--artifact", required=True)
    verify_parser.add_argument("--allow-network", action="store_true")
    verify_parser.add_argument("--json", action="store_true")
    refresh_plan_parser = sub.add_parser("verifier-refresh-plan")
    refresh_plan_parser.add_argument("--adapter", required=True)
    refresh_plan_parser.add_argument("--json", action="store_true")
    refresh_parser = sub.add_parser("verifier-refresh")
    refresh_parser.add_argument("--adapter", required=True)
    refresh_parser.add_argument("--source-url", required=True)
    refresh_parser.add_argument("--yes", action="store_true")
    refresh_parser.add_argument("--json", action="store_true")
    recover_parser = sub.add_parser("recover")
    recover_parser.add_argument("--reset-state", action="store_true")
    recover_parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "verifier-plan":
            return plan(args.adapter, args.json)
        if args.command == "verifier-verify":
            return verify(args.adapter, args.artifact, args.allow_network, args.json)
        if args.command == "verifier-refresh-plan":
            return refresh_plan(args.adapter, args.json)
        if args.command == "verifier-refresh":
            return refresh(args.adapter, args.source_url, args.yes, args.json)
        if args.command == "recover":
            return recover(args.reset_state, args.json)
        return 2
    except (OSError, RuntimeError, json.JSONDecodeError) as exc:
        report = {"verdict": "fail", "error_code": "O7-INTERNAL", "message": type(exc).__name__, "raw_secret_values": 0}
        print(json.dumps(report, indent=2) if getattr(args, "json", False) else f"O7 failure: {type(exc).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

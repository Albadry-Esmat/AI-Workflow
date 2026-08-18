"""Onboarding O6: offline publisher signature and release attestation verification."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import platform as platform_module
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
POLICY_PATH = CONFIG / "onboarding-o6-policy.json"
CATALOG_PATH = CONFIG / "runtime-attestation-o6-catalog.json"
O5_CATALOG_PATH = CONFIG / "runtime-installer-o5-catalog.json"
STATE_ROOT = Path(os.environ.get("AIW_O6_STATE_ROOT", str(ROOT / ".aiw" / "onboarding-o6")))
STATE_PATH = STATE_ROOT / "state.json"
EVIDENCE_PATH = STATE_ROOT / "evidence.jsonl"
STAGING_ROOT = Path(os.environ.get("AIW_O5_STAGING_ROOT", str(ROOT / ".aiw" / "onboarding-o5" / "staging")))


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
    safe = dict(payload)
    safe["raw_secret_values"] = 0
    safe.pop("payload", None)
    safe.pop("signature", None)
    with EVIDENCE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": now(), "event": event, **safe}, sort_keys=True) + "\n")


def current_platform() -> str:
    if sys.platform.startswith("linux"):
        return "linux"
    if sys.platform == "darwin":
        return "macos"
    if sys.platform.startswith("win"):
        return "windows"
    return "unknown"


def current_architecture() -> str:
    machine = platform_module.machine().lower()
    if machine in {"aarch64", "arm64"}:
        return "arm64"
    if machine in {"x86_64", "amd64", "x64"}:
        return "x64"
    return "unknown"


def load_policy() -> dict[str, Any]:
    return load_json(POLICY_PATH)


def load_records() -> list[dict[str, Any]]:
    return load_json(CATALOG_PATH)["records"]


def load_o5_records() -> list[dict[str, Any]]:
    return load_json(O5_CATALOG_PATH)["records"]


def find_record(attestation_id: str) -> dict[str, Any] | None:
    return next((record for record in load_records() if record["attestation_id"] == attestation_id), None)


def find_o5_record(installer_id: str) -> dict[str, Any] | None:
    return next((record for record in load_o5_records() if record["installer_id"] == installer_id), None)


def safe_path(path: Path, root: Path) -> tuple[Path | None, list[str]]:
    reasons: list[str] = []
    try:
        resolved = path.expanduser().resolve(strict=False)
        resolved.relative_to(root.expanduser().resolve(strict=False))
    except (OSError, ValueError):
        return None, ["artifact path is outside the O5 staging root"]
    if path.is_symlink():
        reasons.append("artifact symlink is forbidden")
    return (resolved if not reasons else None), reasons


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def canonical_payload(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def verify_ed25519(public_key_pem: str, payload: bytes, signature_b64: str) -> tuple[bool, str]:
    try:
        signature = base64.b64decode(signature_b64, validate=True)
    except (ValueError, UnicodeError):
        return False, "signature encoding is invalid"
    if len(signature) != 64:
        return False, "Ed25519 signature length is invalid"
    with tempfile.TemporaryDirectory(prefix="aiw-o6-verify-") as temp:
        temp_path = Path(temp)
        public_key = temp_path / "public.pem"
        payload_path = temp_path / "payload.json"
        signature_path = temp_path / "signature.bin"
        public_key.write_text(public_key_pem, encoding="utf-8")
        payload_path.write_bytes(payload)
        signature_path.write_bytes(signature)
        openssl = shutil.which("openssl")
        if not openssl:
            return False, "openssl verifier is unavailable"
        result = subprocess.run([openssl, "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(public_key), "-in", str(payload_path), "-sigfile", str(signature_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return result.returncode == 0, "signature verified" if result.returncode == 0 else "signature verification failed"


def state_template(mode: str, record: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "workflow_id": workflow_id(),
        "mode": mode,
        "attestation_id": record["attestation_id"] if record else None,
        "artifact": {"installer_id": record["artifact_installer_id"] if record else None, "expected_sha256": record["artifact_sha256"] if record else None, "observed_sha256": None, "subject_match": False},
        "signature": {"algorithm": "ed25519" if record else "unknown", "status": "not-run", "bundle_present": False, "signature_valid": False, "trust_root_id": record["trust_root_id"] if record else None},
        "claims": {"identity": None, "identity_match": False, "builder_id": None, "builder_match": False, "repository": None, "repository_match": False, "commit": None, "commit_match": False, "build_type": None, "build_type_match": False, "predicate_type": None, "predicate_match": False, "external_parameters_strict": True, "external_parameters_match": False},
        "trust": {"root_present": False, "root_fingerprint_match": False, "network": False, "transparency_status": "missing"},
        "policy": {"verdict": "blocked", "fail_closed": True, "reasons": []},
        "authentication": {"status": "runtime-owned", "login_started": False, "raw_secret_values": 0},
        "target": {"initialization": "deferred", "mutations": 0, "launch": "deferred", "secret_copy": False},
        "updated_at": now(),
    }


def save_state(state: dict[str, Any]) -> None:
    atomic_json(STATE_PATH, {**state, "updated_at": now()})


def plan(agent: str, as_json: bool) -> int:
    records = [record for record in load_records() if agent == "auto" or record["artifact_installer_id"].startswith(agent)]
    report = {
        "schema_version": "1.0.0",
        "command": "aiw onboarding attestation-plan",
        "verdict": "pass",
        "agent": agent,
        "platform": current_platform(),
        "architecture": current_architecture(),
        "records": [
            {
                "attestation_id": record["attestation_id"],
                "artifact_installer_id": record["artifact_installer_id"],
                "artifact_sha256": record["artifact_sha256"],
                "attestation_path": record["attestation_path"],
                "trust_root_id": record["trust_root_id"],
                "trust_root_path": record["trust_root_path"],
                "expectations": record["expectations"],
                "verification": record["verification"],
                "installation_authorized": False,
                "execution_authorized": False,
                "blocked_reasons": ["O6 is verification-only; installation and execution are not authorized", "network refresh and transparency-log queries are disabled"],
            }
            for record in records
        ],
        "network": "disabled",
        "commands_executed": 0,
        "target_project_mutations": 0,
        "authentication": "runtime-owned",
        "target_initialization": "deferred",
        "launch": "deferred",
        "raw_secret_values": 0,
    }
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print("\nO6 attestation plan")
        for record in report["records"]:
            print(f"  {record['attestation_id']}: offline-only, install/execution unauthorized")
    return 0


def verify(attestation_id: str, artifact_path: str, as_json: bool) -> int:
    record = find_record(attestation_id)
    if record is None:
        report = {"verdict": "fail", "error_code": "O6-ATTESTATION-UNKNOWN", "attestation_id": attestation_id, "raw_secret_values": 0}
        if as_json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print("O6 verification blocked: unknown attestation record", file=sys.stderr)
        return 1
    state = state_template("verify", record)
    reasons: list[str] = []
    o5_record = find_o5_record(record["artifact_installer_id"])
    if o5_record is None:
        reasons.append("linked O5 artifact record is missing")
    artifact, path_reasons = safe_path(Path(artifact_path), STAGING_ROOT)
    reasons.extend(path_reasons)
    if artifact is None or not artifact.is_file():
        reasons.append("artifact is missing from the O5 staging root")
    if artifact is not None and artifact.is_file():
        observed = sha256_file(artifact)
        state["artifact"]["observed_sha256"] = observed
        state["artifact"]["subject_match"] = observed == record["artifact_sha256"]
        if not state["artifact"]["subject_match"]:
            reasons.append("artifact digest does not match attestation subject")
    bundle_path = ROOT / record["attestation_path"]
    trust_path = ROOT / record["trust_root_path"]
    if not bundle_path.is_file():
        reasons.append("attestation bundle is missing")
    if not trust_path.is_file():
        reasons.append("pinned trust root is missing")
    bundle: dict[str, Any] | None = None
    trust_root: dict[str, Any] | None = None
    if bundle_path.is_file():
        try:
            bundle = load_json(bundle_path)
            state["signature"]["bundle_present"] = True
        except (OSError, json.JSONDecodeError):
            reasons.append("attestation bundle is unreadable")
    if trust_path.is_file():
        try:
            trust_root = load_json(trust_path)
            state["trust"]["root_present"] = True
            state["trust"]["root_fingerprint_match"] = hashlib.sha256(trust_root.get("public_key_pem", "").encode("utf-8")).hexdigest() == trust_root.get("public_key_sha256", "").removeprefix("sha256:")
            if not state["trust"]["root_fingerprint_match"]:
                reasons.append("trust-root file fingerprint does not match pinned key fingerprint")
        except (OSError, json.JSONDecodeError):
            reasons.append("trust root is unreadable")
    if bundle and trust_root:
        if bundle.get("trust_root_id") != record["trust_root_id"] or trust_root.get("trust_root_id") != record["trust_root_id"]:
            reasons.append("trust-root identity does not match attestation record")
        payload = bundle.get("payload")
        if not isinstance(payload, dict):
            reasons.append("attestation payload is missing")
        else:
            expectations = record["expectations"]
            subject = payload.get("subject") if isinstance(payload.get("subject"), dict) else {}
            claims = state["claims"]
            claims.update({"identity": payload.get("publisher"), "identity_match": payload.get("publisher") == expectations["publisher"], "builder_id": payload.get("builder_id"), "builder_match": payload.get("builder_id") == expectations["builder_id"], "repository": payload.get("source_repository"), "repository_match": payload.get("source_repository") == expectations["source_repository"], "commit": payload.get("commit"), "commit_match": payload.get("commit") == expectations["commit"], "build_type": payload.get("build_type"), "build_type_match": payload.get("build_type") == expectations["build_type"], "predicate_type": payload.get("predicate_type"), "predicate_match": payload.get("predicate_type") == expectations["predicate_type"], "external_parameters_match": payload.get("external_parameters") == expectations["external_parameters"]})
            for key in ("identity_match", "builder_match", "repository_match", "commit_match", "build_type_match", "predicate_match", "external_parameters_match"):
                if not claims[key]:
                    reasons.append(f"attestation claim mismatch: {key}")
            if subject.get("digest") != record["artifact_sha256"]:
                reasons.append("attestation subject digest does not match catalog digest")
            if payload.get("predicate_type") != expectations["predicate_type"]:
                reasons.append("attestation predicate type does not match expectation")
            signature_ok, signature_reason = verify_ed25519(trust_root.get("public_key_pem", ""), canonical_payload(payload), bundle.get("signature", ""))
            state["signature"]["signature_valid"] = signature_ok
            state["signature"]["status"] = "passed" if signature_ok else "failed"
            if not signature_ok:
                reasons.append(signature_reason)
            state["trust"]["transparency_status"] = bundle.get("transparency", {}).get("status", "missing")
            if state["trust"]["transparency_status"] not in {"local-evidence", "not-required"}:
                reasons.append("required local transparency evidence is missing")
    if not reasons:
        state["policy"]["verdict"] = "pass"
        state["policy"]["reasons"] = []
    else:
        state["policy"]["verdict"] = "fail"
        state["policy"]["reasons"] = reasons
    save_state(state)
    append_evidence("attestation-verification", {"attestation_id": attestation_id, "verdict": state["policy"]["verdict"], "signature_valid": state["signature"]["signature_valid"], "subject_match": state["artifact"]["subject_match"], "network": False, "target_project_mutations": 0})
    report = {"schema_version": "1.0.0", "command": "aiw onboarding attestation-verify", "verdict": state["policy"]["verdict"], "attestation_id": attestation_id, "artifact": state["artifact"], "signature": state["signature"], "claims": state["claims"], "trust": state["trust"], "policy": state["policy"], "authentication": state["authentication"], "target": state["target"], "installation_authorized": False, "execution_authorized": False, "state_path": state_path_display(), "raw_secret_values": 0}
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print("\nO6 attestation verification")
        print(f"  verdict: {report['verdict']}")
        print(f"  signature: {report['signature']['status']}; subject: {report['artifact']['subject_match']}")
        for reason in report["policy"]["reasons"]:
            print(f"  reason: {reason}")
    return 0 if report["verdict"] == "pass" else 1


def recover(reset_state: bool, as_json: bool) -> int:
    if reset_state:
        for path in (STATE_PATH, EVIDENCE_PATH):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        report = {"verdict": "pass", "recovered": True, "reset_state": True, "owned_paths_only": True, "artifact_preserved": True, "runtime_changes": 0, "target_project_changes": 0}
    else:
        report = {"verdict": "pass", "recovered": STATE_PATH.exists(), "owned_paths_only": True, "artifact_preserved": True, "runtime_changes": 0, "target_project_changes": 0}
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print("O6 recovery: " + ("state reset" if reset_state else "no state changed"))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AI Workflow O6 offline attestation verification")
    sub = parser.add_subparsers(dest="command", required=True)
    plan_parser = sub.add_parser("attestation-plan")
    plan_parser.add_argument("--agent", default="auto")
    plan_parser.add_argument("--json", action="store_true")
    verify_parser = sub.add_parser("attestation-verify")
    verify_parser.add_argument("--attestation", required=True)
    verify_parser.add_argument("--artifact", required=True)
    verify_parser.add_argument("--json", action="store_true")
    recover_parser = sub.add_parser("recover")
    recover_parser.add_argument("--reset-state", action="store_true")
    recover_parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "attestation-plan":
            return plan(args.agent, args.json)
        if args.command == "attestation-verify":
            return verify(args.attestation, args.artifact, args.json)
        if args.command == "recover":
            return recover(args.reset_state, args.json)
        return 2
    except (OSError, RuntimeError, json.JSONDecodeError) as exc:
        report = {"verdict": "fail", "error_code": "O6-INTERNAL", "message": type(exc).__name__, "raw_secret_values": 0}
        print(json.dumps(report, indent=2) if getattr(args, "json", False) else f"O6 failure: {type(exc).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

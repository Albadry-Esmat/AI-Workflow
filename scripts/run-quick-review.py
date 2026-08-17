#!/usr/bin/env python3
"""Run a bounded local quick-review adapter and persist Batch 4 evidence.

The repository stores declarative skill contracts rather than a checked-in LLM
orchestrator. This adapter therefore exercises the evidence boundary with
safe deterministic checks and controlled failure scenarios. It does not claim
to replace OpenCode skill execution.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_DIR = ROOT / "config" / "execution-contracts"
SKILLS = ["clean-code-review", "security-review"]
SCENARIOS = {"success", "schema-failure", "tool-failure", "retry-exhaustion"}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def identifier(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def load_schema(contract_type: str) -> Draft7Validator:
    schema_path = CONTRACT_DIR / f"{contract_type}.schema.json"
    with schema_path.open() as handle:
        schema = json.load(handle)
    return Draft7Validator(schema, format_checker=FormatChecker())


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def write_contract(contract_type: str, value: dict[str, Any], path: Path) -> None:
    errors = sorted(load_schema(contract_type).iter_errors(value), key=lambda error: list(error.path))
    if errors:
        details = "; ".join(error.message for error in errors)
        raise ValueError(f"{contract_type} is invalid: {details}")
    write_json(path, value)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_value(target: Path, *args: str) -> str | None:
    try:
        return subprocess.check_output(["git", "-C", str(target), *args], text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def run_command(command: list[str], cwd: Path) -> tuple[bool, str]:
    try:
        result = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    except OSError as error:
        return False, str(error)
    return result.returncode == 0, result.stdout[-2000:]


def base_policy(run_id: str, policy_id: str, resource: str) -> dict[str, Any]:
    return {
        "contract_type": "policy-decision",
        "contract_version": "1.0.0",
        "policy_decision_id": policy_id,
        "run_id": run_id,
        "action": "read",
        "resource": resource,
        "decision": "allow",
        "risk_tier": "low",
        "requested_capabilities": ["filesystem-read"],
        "policy_version": "1.0.0",
        "evaluated_at": now(),
        "approval_required": False,
        "gate_id": None,
        "reasons": ["Quick-review adapter is read-only and bounded to the declared project path."],
        "obligations": ["Persist only redacted metadata and artifact references."],
        "expires_at": None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the bounded Batch 4 quick-review evidence adapter")
    parser.add_argument("--target", default=".", help="Project directory to review")
    parser.add_argument("--scenario", choices=sorted(SCENARIOS), default="success")
    parser.add_argument("--run-id", help="Deterministic RUN-xxxxxxxxxxxx identifier for fixtures")
    parser.add_argument("--output-root", default=str(ROOT / ".opencode" / "state" / "evidence"))
    args = parser.parse_args()

    target = Path(args.target).expanduser().resolve()
    if not target.is_dir():
        print(f"ERROR: target directory does not exist: {target}", file=sys.stderr)
        return 2

    run_id = args.run_id or identifier("RUN")
    if not run_id.startswith("RUN-") or len(run_id) != 16:
        print("ERROR: --run-id must match RUN-xxxxxxxxxxxx", file=sys.stderr)
        return 2

    output_dir = Path(args.output_root).expanduser().resolve() / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    started_at = now()
    source_commit = git_value(target, "rev-parse", "HEAD") or "0" * 40
    project_root = f"file://{target}"
    step_ids = [identifier("STEP") for _ in SKILLS]
    artifact_ids = [identifier("ART") for _ in SKILLS]
    policy_ids = [identifier("POL") for _ in SKILLS]
    gate_id = identifier("GATE")

    manifest_base: dict[str, Any] = {
        "contract_type": "run-manifest",
        "contract_version": "1.0.0",
        "run_id": run_id,
        "pipeline_template": "quick-review",
        "pipeline_mode": "specialized_review",
        "source_commit": source_commit,
        "project_root": project_root,
        "requested_by": {"actor_id": "aiw:quick-review-adapter", "actor_type": "system"},
        "started_at": started_at,
        "completed_at": None,
        "status": "running",
        "step_ids": step_ids,
        "artifact_ids": artifact_ids,
        "gate_decision_ids": [gate_id],
        "policy_decision_ids": policy_ids,
        "result_artifact_ids": artifact_ids,
        "evidence_uri": f"file://{output_dir}",
        "failure": None,
        "pii_scrubbed": True,
        "redaction_profile": "strict-v1",
        "labels": {"scenario": args.scenario, "adapter": "local-deterministic"},
    }
    write_contract("run-manifest", manifest_base, output_dir / "run-manifest.start.json")

    step_records: list[dict[str, Any]] = []
    output_artifacts: list[dict[str, Any]] = []
    failed_step_id: str | None = None
    failure: dict[str, Any] | None = None

    for index, skill_name in enumerate(SKILLS):
        step_id = step_ids[index]
        artifact_id = artifact_ids[index]
        policy_id = policy_ids[index]
        policy = base_policy(run_id, policy_id, project_root)
        write_contract("policy-decision", policy, output_dir / f"{policy_id}.json")
        step_started = now()
        status = "succeeded"
        attempt = 1
        retryable = False
        error: dict[str, Any] | None = None
        check_summary: dict[str, Any] = {"skill": skill_name, "scenario": args.scenario, "target": str(target)}

        if index == 0 and args.scenario != "success":
            failed_step_id = step_id
            if args.scenario == "schema-failure":
                status = "failed"
                attempt = 3
                retryable = True
                error = {"code": "OUTPUT_SCHEMA_INVALID", "message": "Controlled fixture: skill output failed schema validation after retries.", "category": "validation"}
            elif args.scenario == "tool-failure":
                status = "failed"
                retryable = True
                error = {"code": "TOOL_EXECUTION_FAILED", "message": "Controlled fixture: read-only review tool returned a failure.", "category": "tool"}
            else:
                status = "failed"
                attempt = 3
                retryable = False
                error = {"code": "RETRY_EXHAUSTED", "message": "Controlled fixture: maximum retry budget was exhausted.", "category": "timeout"}
            check_summary["controlled_failure"] = True
        elif failed_step_id:
            status = "skipped"
            check_summary["skipped_after_step_id"] = failed_step_id
        else:
            if skill_name == "clean-code-review":
                check_ok, output = run_command(["git", "diff", "--check"], target) if git_value(target, "rev-parse", "--show-toplevel") else (False, "Target is not a Git worktree")
                check_summary["git_diff_check"] = "pass" if check_ok else "not-run-or-failed"
                check_summary["tool_output_tail"] = output[-500:]
                if not check_ok:
                    status = "failed"
                    failed_step_id = step_id
                    retryable = False
                    error = {"code": "TOOL_EXECUTION_FAILED", "message": "The clean-code review adapter could not complete its read-only Git check.", "category": "tool"}
            else:
                check_summary["security_boundary"] = "read-only; no credentials or external writes"
                tracked = git_value(target, "ls-files")
                secret_hits: list[str] = []
                if tracked is not None:
                    for relative_path in tracked.splitlines():
                        candidate = target / relative_path
                        if not candidate.is_file() or candidate.stat().st_size > 2_000_000:
                            continue
                        try:
                            text = candidate.read_text(errors="ignore")
                        except OSError:
                            continue
                        patterns = [
                            ("private-key", r"-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----"),
                            ("classic-pat", r"ghp_[A-Za-z0-9]{20,}"),
                            ("fine-grained-pat", r"github_pat_[A-Za-z0-9_]{20,}"),
                            ("aws-access-key", r"\\bAKIA[0-9A-Z]{16}\\b"),
                        ]
                        for label, pattern in patterns:
                            if re.search(pattern, text):
                                secret_hits.append(f"{relative_path}:{label}")
                    check_summary["secret_scan"] = "pass" if not secret_hits else "fail"
                    check_summary["secret_hits"] = secret_hits[:20]
                else:
                    check_summary["secret_scan"] = "not-run-non-git-target"
                    check_summary["secret_hits"] = []
                check_summary["critical_findings"] = len(secret_hits)
                if secret_hits:
                    status = "failed"
                    failed_step_id = step_id
                    retryable = False
                    error = {"code": "SECRET_PATTERN_DETECTED", "message": "Tracked-file security scan detected a high-confidence credential pattern.", "category": "validation"}

        report_path = output_dir / f"{artifact_id}.json"
        write_json(report_path, {"run_id": run_id, "step_id": step_id, "skill": skill_name, "status": status, "summary": check_summary, "error": error, "pii_scrubbed": True})
        artifact = {
            "contract_type": "artifact-reference",
            "contract_version": "1.0.0",
            "artifact_id": artifact_id,
            "run_id": run_id,
            "kind": "test-report",
            "uri": f"file://{report_path}",
            "sha256": sha256(report_path),
            "size_bytes": report_path.stat().st_size,
            "media_type": "application/json",
            "classification": "internal",
            "contains_pii": False,
            "retention_class": "audit",
            "created_at": now(),
            "producer_step_id": step_id,
            "expires_at": None,
            "label": f"{skill_name} Batch 4 evidence",
            "metadata": {"adapter": "local-deterministic", "scenario": args.scenario},
        }
        write_contract("artifact-reference", artifact, output_dir / f"{artifact_id}.reference.json")
        output_artifacts.append(artifact)
        step = {
            "contract_type": "step-execution",
            "contract_version": "1.0.0",
            "step_id": step_id,
            "run_id": run_id,
            "skill_id": skill_name,
            "skill_version": "1.0.0",
            "phase": "quick-review",
            "sequence": index,
            "status": status,
            "started_at": step_started,
            "completed_at": now(),
            "duration_ms": 0,
            "input_artifact_ids": [],
            "output_artifact_ids": [artifact_id],
            "policy_decision_id": policy_id,
            "gate_decision_id": gate_id,
            "attempt": attempt,
            "retryable": retryable,
            "error": error,
            "metrics": {"input_tokens": 0, "output_tokens": 0, "tool_calls": 1 if status != "skipped" else 0, "estimated_cost_usd": 0},
            "pii_scrubbed": True,
        }
        write_contract("step-execution", step, output_dir / f"{step_id}.json")
        step_records.append(step)

    final_status = "failed" if failed_step_id else "completed"
    gate_decision = {
        "contract_type": "gate-decision",
        "contract_version": "1.0.0",
        "gate_id": gate_id,
        "run_id": run_id,
        "gate_type": "security",
        "subject": "quick-review read-only result",
        "decision": "rejected" if failed_step_id else "approved",
        "requested_at": started_at,
        "decided_at": now(),
        "actor_type": "system",
        "actor_id": "aiw:quick-review-adapter",
        "evidence_artifact_ids": artifact_ids,
        "policy_decision_ids": policy_ids,
        "irreversible_action": False,
        "approval_scope": "Read-only local evidence generation",
        "reason": "Controlled failure recorded; no progression authorized." if failed_step_id else "No critical findings or write actions were present in the bounded adapter.",
        "constraints": ["No external writes", "No credential use", "No deployment or publication"],
        "expires_at": None,
    }
    write_contract("gate-decision", gate_decision, output_dir / f"{gate_id}.json")

    summary = {
        "summary_version": "1.0.0",
        "run_id": run_id,
        "pipeline_template": "quick-review",
        "scenario": args.scenario,
        "final_status": final_status,
        "first_failure_step_id": failed_step_id,
        "failure": failure,
        "failed_step_ids": [failed_step_id] if failed_step_id else [],
        "retry_summary": {"attempted": any(step["attempt"] > 1 for step in step_records), "max_attempts": max(step["attempt"] for step in step_records)},
        "affected_artifact_ids": artifact_ids,
        "gate_decision_id": gate_id,
        "policy_decision_ids": policy_ids,
        "redaction_profile": "strict-v1",
        "created_at": now(),
    }
    if failed_step_id:
        failed_record = next(step for step in step_records if step["step_id"] == failed_step_id)
        summary["failure"] = {"code": failed_record["error"]["code"], "category": failed_record["error"]["category"], "message": failed_record["error"]["message"]}
        failure = {"code": failed_record["error"]["code"], "message": failed_record["error"]["message"], "retryable": failed_record["retryable"], "failed_step_id": failed_step_id}
    write_json(output_dir / "terminal-summary.json", summary)

    manifest = dict(manifest_base)
    manifest["completed_at"] = now()
    manifest["status"] = final_status
    manifest["failure"] = failure
    write_contract("run-manifest", manifest, output_dir / "run-manifest.json")
    (Path(args.output_root).expanduser().resolve() / "last_run.txt").write_text(f"{run_id}\n")

    print(json.dumps({"run_id": run_id, "status": final_status, "evidence_dir": str(output_dir), "first_failure_step_id": failed_step_id, "artifact_ids": artifact_ids}, indent=2))
    return 0 if not failed_step_id else 1


if __name__ == "__main__":
    raise SystemExit(main())

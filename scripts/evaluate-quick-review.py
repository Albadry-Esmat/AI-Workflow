#!/usr/bin/env python3
"""Evaluate the Batch 4 quick-review adapter with golden cases and safe replays."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
EVAL_ROOT = ROOT / "evals" / "quick-review"
CASE_ROOT = EVAL_ROOT / "cases"
FIXTURE_ROOT = EVAL_ROOT / "fixtures"
REPLAY_ROOT = EVAL_ROOT / "replays"
CONTRACT_ROOT = ROOT / "config" / "execution-contracts"
RUNNER = ROOT / "scripts" / "run-quick-review.py"
CONTRACT_TYPES = ["run-manifest", "step-execution", "artifact-reference", "gate-decision", "policy-decision"]
SECRET_MARKERS = ["-----BEGIN ", "ghp_", "github_pat_", "AKIA"]


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    with path.open() as handle:
        return json.load(handle)


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_contract(contract_type: str, value: dict[str, Any]) -> list[str]:
    schema = load_json(CONTRACT_ROOT / f"{contract_type}.schema.json")
    errors = Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(value)
    return [error.message for error in errors]


def git(*args: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)


def make_git_fixture(fixture_name: str, temp_root: Path) -> Path:
    source = FIXTURE_ROOT / fixture_name
    target = temp_root / fixture_name
    shutil.copytree(source, target)
    initialized = git("init", "-q", cwd=target)
    if initialized.returncode != 0:
        raise RuntimeError(f"Could not initialize fixture repository: {initialized.stdout}")
    staged = git("add", ".", cwd=target)
    committed = git("-c", "user.name=AI Workflow Eval", "-c", "user.email=eval@aiw.local", "commit", "-qm", "fixture", cwd=target)
    if staged.returncode != 0 or committed.returncode != 0:
        raise RuntimeError(f"Could not commit fixture {fixture_name}: {staged.stdout}{committed.stdout}")
    return target


def expected_step_statuses(summary: dict[str, Any]) -> dict[str, str]:
    return {"clean-code-review": "unknown", "security-review": "unknown"} if not summary else {}


def contract_grade(run_dir: Path, run_id: str) -> tuple[bool, list[str]]:
    errors: list[str] = []
    manifest_path = run_dir / "run-manifest.json"
    summary_path = run_dir / "terminal-summary.json"
    if not manifest_path.exists() or not summary_path.exists():
        return False, ["run-manifest.json and terminal-summary.json are required"]
    manifest = load_json(manifest_path)
    if manifest.get("run_id") != run_id:
        errors.append("manifest run_id mismatch")
    errors.extend(f"run-manifest: {message}" for message in validate_contract("run-manifest", manifest))
    step_paths = sorted(run_dir.glob("STEP-*.json"))
    artifact_refs = sorted(run_dir.glob("ART-*.reference.json"))
    policy_paths = sorted(run_dir.glob("POL-*.json"))
    gate_paths = sorted(run_dir.glob("GATE-*.json"))
    if len(step_paths) != 2:
        errors.append(f"expected 2 step records, found {len(step_paths)}")
    if len(artifact_refs) != 2:
        errors.append(f"expected 2 artifact references, found {len(artifact_refs)}")
    if len(policy_paths) != 2:
        errors.append(f"expected 2 policy records, found {len(policy_paths)}")
    if len(gate_paths) != 1:
        errors.append(f"expected 1 gate record, found {len(gate_paths)}")
    for path in step_paths:
        step = load_json(path)
        errors.extend(f"{path.name}: {message}" for message in validate_contract("step-execution", step))
        if step.get("run_id") != run_id:
            errors.append(f"{path.name}: run_id mismatch")
    for path in policy_paths:
        policy = load_json(path)
        errors.extend(f"{path.name}: {message}" for message in validate_contract("policy-decision", policy))
    for path in gate_paths:
        gate = load_json(path)
        errors.extend(f"{path.name}: {message}" for message in validate_contract("gate-decision", gate))
    for path in artifact_refs:
        artifact = load_json(path)
        errors.extend(f"{path.name}: {message}" for message in validate_contract("artifact-reference", artifact))
        payload_path = Path(artifact["uri"].removeprefix("file://"))
        if not payload_path.exists() or sha256(payload_path) != artifact["sha256"]:
            errors.append(f"{path.name}: artifact digest does not match payload")
    return not errors, errors


def read_step_statuses(run_dir: Path) -> dict[str, str]:
    statuses: dict[str, str] = {}
    for path in run_dir.glob("STEP-*.json"):
        record = load_json(path)
        statuses[record["skill_id"]] = record["status"]
    return statuses


def grade_live_case(case: dict[str, Any], run_dir: Path, run_id: str, target: Path, before_status: str, after_status: str) -> dict[str, Any]:
    expected = case["expected"]
    manifest = load_json(run_dir / "run-manifest.json")
    summary = load_json(run_dir / "terminal-summary.json")
    gate = load_json(next(run_dir.glob("GATE-*.json")))
    steps = read_step_statuses(run_dir)
    policies = [load_json(path) for path in sorted(run_dir.glob("POL-*.json"))]
    structure_ok, structure_errors = contract_grade(run_dir, run_id)
    expected_status_ok = manifest.get("status") == expected["final_status"] and summary.get("final_status") == expected["final_status"]
    expected_gate_ok = gate.get("decision") == expected["gate_decision"]
    first_failure_ok = (expected.get("first_failure") is None and summary.get("first_failure_step_id") is None) or (
        summary.get("failure", {}).get("code") == expected.get("first_failure_code")
    )
    steps_ok = all(steps.get(skill) == status for skill, status in expected["required_step_statuses"].items())
    behavior_ok = expected_status_ok and expected_gate_ok and first_failure_ok and steps_ok
    security_payload = "\n".join(path.read_text(errors="ignore") for path in run_dir.rglob("*.json"))
    security_ok = all(marker not in security_payload for marker in SECRET_MARKERS) and manifest.get("pii_scrubbed") is True and gate.get("irreversible_action") is False
    traceability_ok = (
        set(manifest.get("step_ids", [])) == {load_json(path)["step_id"] for path in run_dir.glob("STEP-*.json")}
        and set(manifest.get("artifact_ids", [])) == {load_json(path)["artifact_id"] for path in run_dir.glob("ART-*.reference.json")}
        and set(manifest.get("policy_decision_ids", [])) == {policy["policy_decision_id"] for policy in policies}
    )
    replay_safety_ok = before_status == after_status and not any(path.name.startswith("write") for path in target.rglob("*"))
    budget = manifest.get("budget", {})
    expected_budget_status = expected.get("budget_status", "within")
    budget_status = "cancelled" if summary.get("final_status") == "cancelled" else "exhausted" if budget.get("exhausted") else "within"
    budget_ok = budget_status == expected_budget_status and budget.get("exhausted_dimension") == expected.get("budget_exhausted_dimension")
    retry_summary = summary.get("retry_summary", {})
    retry_ok = sorted(retry_summary.get("reason_codes", [])) == sorted(expected.get("retry_reason_codes", []))
    policy_decisions = {item.get("decision") for item in policies}
    policy_ok = (
        expected.get("policy_decision", "allow") in policy_decisions
        and all(item.get("enforcement_boundary") == expected.get("enforcement_boundary", "local-adapter") for item in policies)
        and any(bool(item.get("approval_required")) == expected.get("approval_required", False) for item in policies)
    )
    components = {
        "structure": {"passed": structure_ok, "errors": structure_errors},
        "behavior": {"passed": behavior_ok, "errors": [] if behavior_ok else ["result did not match expected behavior"]},
        "security": {"passed": security_ok, "errors": [] if security_ok else ["evidence security invariant failed"]},
        "traceability": {"passed": traceability_ok, "errors": [] if traceability_ok else ["manifest references do not match evidence files"]},
        "replay-safety": {"passed": replay_safety_ok, "errors": [] if replay_safety_ok else ["target repository changed during read-only run"]},
        "budget": {"passed": budget_ok, "errors": [] if budget_ok else ["budget status or exhaustion dimension did not match expected result"]},
        "retry": {"passed": retry_ok, "errors": [] if retry_ok else ["retry reason taxonomy did not match expected result"]},
        "policy": {"passed": policy_ok, "errors": [] if policy_ok else ["policy decision or enforcement boundary did not match expected result"]},
    }
    return {
        "case_id": case["case_id"],
        "evaluation_class": case["evaluation_class"],
        "fixture": case["fixture"],
        "mode": "live",
        "scenario": case["scenario"],
        "run_id": run_id,
        "passed": all(component["passed"] for component in components.values()),
        "components": components,
        "first_failure_code": (summary.get("failure") or {}).get("code"),
        "final_status": summary.get("final_status"),
        "gate_decision": gate.get("decision"),
        "budget_status": budget_status,
        "policy_decisions": sorted(policy_decisions),
    }


def grade_replay_case(case: dict[str, Any]) -> dict[str, Any]:
    replay = load_json(REPLAY_ROOT / f"{case['case_id']}.json")
    expected = case["expected"]
    result = replay["result"]
    response_text = json.dumps(replay["tool_responses"], sort_keys=True)
    no_external_write = all(item.get("tool") != "external-write" for item in replay["tool_responses"])
    structure_ok = replay.get("replay_version") == "1.0.0" and replay.get("case_id") == case["case_id"] and bool(replay.get("tool_responses"))
    behavior_ok = all([
        result.get("final_status") == expected["final_status"],
        result.get("gate_decision") == expected["gate_decision"],
        result.get("first_failure_code") == expected["first_failure_code"],
        result.get("security_scan") == expected["security_scan"],
    ])
    security_ok = "ghp_" not in response_text and "github_pat_" not in response_text and no_external_write
    traceability_ok = result.get("step_statuses") == expected["required_step_statuses"]
    replay_safety_ok = no_external_write and replay.get("replay_version") == "1.0.0"
    budget_ok = result.get("budget_status", "within") == expected.get("budget_status", "within") and result.get("budget_exhausted_dimension") == expected.get("budget_exhausted_dimension")
    retry_ok = sorted(result.get("retry_reason_codes", [])) == sorted(expected.get("retry_reason_codes", []))
    policy_ok = result.get("policy_decision", "allow") == expected.get("policy_decision", "allow") and result.get("enforcement_boundary", "local-adapter") == expected.get("enforcement_boundary", "local-adapter")
    components = {
        "structure": {"passed": structure_ok, "errors": [] if structure_ok else ["invalid replay trace"]},
        "behavior": {"passed": behavior_ok, "errors": [] if behavior_ok else ["replay result did not match expected behavior"]},
        "security": {"passed": security_ok, "errors": [] if security_ok else ["replay contains unsafe or external-write evidence"]},
        "traceability": {"passed": traceability_ok, "errors": [] if traceability_ok else ["replay step statuses do not match expected result"]},
        "replay-safety": {"passed": replay_safety_ok, "errors": [] if replay_safety_ok else ["replay safety invariant failed"]},
        "budget": {"passed": budget_ok, "errors": [] if budget_ok else ["replay budget result did not match expected result"]},
        "retry": {"passed": retry_ok, "errors": [] if retry_ok else ["replay retry taxonomy did not match expected result"]},
        "policy": {"passed": policy_ok, "errors": [] if policy_ok else ["replay policy result did not match expected result"]},
    }
    return {
        "case_id": case["case_id"],
        "evaluation_class": case["evaluation_class"],
        "fixture": case["fixture"],
        "mode": "replay",
        "scenario": case["scenario"],
        "run_id": None,
        "passed": all(component["passed"] for component in components.values()),
        "components": components,
        "first_failure_code": result.get("first_failure_code"),
        "final_status": result.get("final_status"),
        "gate_decision": result.get("gate_decision"),
        "budget_status": result.get("budget_status", "within"),
        "policy_decision": result.get("policy_decision", "allow"),
    }


def evaluate(output_root: Path) -> dict[str, Any]:
    cases = [load_json(path) for path in sorted(CASE_ROOT.glob("*.json"))]
    results: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="aiw-quick-review-eval-") as temp:
        temp_root = Path(temp)
        for case in cases:
            if case["execution_mode"] == "replay":
                results.append(grade_replay_case(case))
                continue
            target = make_git_fixture(case["fixture"], temp_root / case["case_id"])
            before = git("status", "--porcelain", cwd=target).stdout
            run_id = "RUN-" + hashlib.sha256(case["case_id"].encode()).hexdigest()[:12]
            run_root = temp_root / "runs"
            command = [sys.executable, str(RUNNER), "--target", str(target), "--scenario", case["scenario"], "--run-id", run_id, "--output-root", str(run_root)]
            completed = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
            run_dir = run_root / run_id
            after = git("status", "--porcelain", cwd=target).stdout
            if not run_dir.exists():
                results.append({"case_id": case["case_id"], "evaluation_class": case["evaluation_class"], "fixture": case["fixture"], "mode": "live", "scenario": case["scenario"], "run_id": run_id, "passed": False, "components": {"execution": {"passed": False, "errors": [completed.stdout[-1000:]]}}})
                continue
            result = grade_live_case(case, run_dir, run_id, target, before, after)
            result["runner_exit_code"] = completed.returncode
            result["runner_output_tail"] = completed.stdout[-500:]
            results.append(result)
    passed = sum(1 for result in results if result["passed"])
    golden = [result for result in results if result["evaluation_class"] == "golden"]
    adversarial = [result for result in results if result["evaluation_class"] == "adversarial"]
    component_totals = {}
    for result in results:
        for name, component in result.get("components", {}).items():
            total = component_totals.setdefault(name, {"passed": 0, "total": 0})
            total["total"] += 1
            total["passed"] += int(component["passed"])
    report = {
        "report_version": "1.0.0",
        "suite": "quick-review",
        "created_at": now(),
        "pipeline_template": "quick-review",
        "total_cases": len(results),
        "passed_cases": passed,
        "failed_cases": len(results) - passed,
        "golden_cases": {"total": len(golden), "passed": sum(int(item["passed"]) for item in golden)},
        "adversarial_cases": {"total": len(adversarial), "passed": sum(int(item["passed"]) for item in adversarial)},
        "component_scores": component_totals,
        "overall_pass": passed == len(results),
        "results": results,
        "limitations": ["Evaluation uses the bounded local deterministic adapter; it does not invoke an external LLM or the declarative OpenCode orchestrator."],
    }
    write_json(output_root / "evaluation-report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate quick-review golden and adversarial cases")
    parser.add_argument("--output-root", default=str(EVAL_ROOT / "reports"))
    args = parser.parse_args()
    report = evaluate(Path(args.output_root).expanduser().resolve())
    print(json.dumps({"suite": report["suite"], "total": report["total_cases"], "passed": report["passed_cases"], "failed": report["failed_cases"], "overall_pass": report["overall_pass"], "report": str(Path(args.output_root).expanduser().resolve() / "evaluation-report.json")}, indent=2))
    return 0 if report["overall_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

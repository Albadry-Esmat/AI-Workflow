#!/usr/bin/env python3
"""Generate committed Batch 5 quick-review fixtures and evaluation cases."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL_ROOT = ROOT / "evals" / "quick-review"
FIXTURE_ROOT = EVAL_ROOT / "fixtures"
CASE_ROOT = EVAL_ROOT / "cases"
REPLAY_ROOT = EVAL_ROOT / "replays"


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value.rstrip() + "\n")


def case(case_id: str, evaluation_class: str, fixture: str, scenario: str, execution_mode: str, task: str, expected: dict, allowed_tools: list[str] | None = None) -> dict:
    return {
        "case_id": case_id,
        "case_version": "1.0.0",
        "evaluation_class": evaluation_class,
        "pipeline_template": "quick-review",
        "fixture": fixture,
        "scenario": scenario,
        "execution_mode": execution_mode,
        "task": task,
        "policy_profile": "quick-review-read-only-v1",
        "allowed_tools": allowed_tools or ["git_diff_check", "tracked_file_secret_scan"],
        "sensitivity_class": "internal",
        "expected": expected,
        "grader_set": ["structure", "behavior", "security", "traceability", "replay-safety"],
    }


def main() -> None:
    for directory in (FIXTURE_ROOT, CASE_ROOT, REPLAY_ROOT):
        directory.mkdir(parents=True, exist_ok=True)

    fixture_files = {
        "web/README.md": "# Web Fixture\n\nA small static web project used for read-only quick-review evaluation.\n",
        "web/package.json": '{\n  "name": "quick-review-web-fixture",\n  "private": true,\n  "scripts": {"test": "node src/app.js"}\n}\n',
        "web/src/app.js": "export function renderGreeting(name) {\n  return `<main>Hello, ${name}</main>`;\n}\n",
        "api/README.md": "# API Fixture\n\nA minimal API boundary with explicit input validation.\n",
        "api/openapi.yaml": "openapi: 3.0.3\ninfo:\n  title: Review Fixture API\n  version: 1.0.0\npaths:\n  /health:\n    get:\n      responses:\n        '200':\n          description: Healthy\n",
        "api/src/api.py": "def health() -> dict[str, str]:\n    return {\"status\": \"ok\"}\n",
        "data/README.md": "# Data Fixture\n\nA small deterministic dataset and transformation module.\n",
        "data/input.csv": "id,value\n1,10\n2,20\n3,30\n",
        "data/transform.py": "import csv\nfrom pathlib import Path\n\ndef total(path: str) -> int:\n    with Path(path).open(newline=\"\") as handle:\n        return sum(int(row[\"value\"]) for row in csv.DictReader(handle))\n",
        "infra/README.md": "# Infrastructure Fixture\n\nA deliberately read-only infrastructure review fixture.\n",
        "infra/Dockerfile": "FROM python:3.12-slim\nWORKDIR /app\nCOPY . /app\nCMD [\"python\", \"-c\", \"print('fixture')\"]\n",
        "infra/deployment.yaml": "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: review-fixture\nspec:\n  replicas: 1\n",
    }
    for relative, content in fixture_files.items():
        write_text(FIXTURE_ROOT / relative, content)

    expected_success = {
        "final_status": "completed",
        "gate_decision": "approved",
        "first_failure": None,
        "security_scan": "pass",
        "required_step_statuses": {"clean-code-review": "succeeded", "security-review": "succeeded"},
        "no_external_writes": True,
    }
    expected_schema_failure = {
        "final_status": "failed",
        "gate_decision": "rejected",
        "first_failure_code": "OUTPUT_SCHEMA_INVALID",
        "security_scan": "not-required-after-first-failure",
        "required_step_statuses": {"clean-code-review": "failed", "security-review": "skipped"},
        "no_external_writes": True,
    }
    expected_tool_failure = {
        "final_status": "failed",
        "gate_decision": "rejected",
        "first_failure_code": "TOOL_EXECUTION_FAILED",
        "security_scan": "not-required-after-first-failure",
        "required_step_statuses": {"clean-code-review": "failed", "security-review": "skipped"},
        "no_external_writes": True,
    }
    expected_retry_failure = {
        "final_status": "failed",
        "gate_decision": "rejected",
        "first_failure_code": "RETRY_EXHAUSTED",
        "security_scan": "not-required-after-first-failure",
        "required_step_statuses": {"clean-code-review": "failed", "security-review": "skipped"},
        "no_external_writes": True,
    }
    cases = []
    for case_id, fixture, task in [
        ("G01", "web", "Review the web fixture for clean-code and security regressions."),
        ("G02", "web", "Review the web fixture before a UI-only change."),
        ("G03", "web", "Review the web fixture for safe read-only handling."),
        ("G04", "api", "Review the API fixture for boundary and security issues."),
        ("G05", "api", "Review the API fixture before a contract change."),
        ("G06", "api", "Review the API fixture for clean-code regressions."),
        ("G07", "data", "Review the data fixture for deterministic transformation quality."),
        ("G08", "data", "Review the data fixture for security and maintainability."),
        ("G09", "infra", "Review the infrastructure fixture without deployment access."),
        ("G10", "infra", "Review the infrastructure fixture for safe configuration."),
    ]:
        cases.append(case(case_id, "golden", fixture, "success", "live", task, expected_success))
    cases.extend([
        case("A01", "adversarial", "web", "schema-failure", "live", "Simulate malformed review output and verify fail-closed handling.", expected_schema_failure),
        case("A02", "adversarial", "api", "tool-failure", "live", "Simulate a read-only tool failure and verify downstream suppression.", expected_tool_failure),
        case("A03", "adversarial", "data", "retry-exhaustion", "live", "Simulate repeated validation failure and verify retry exhaustion.", expected_retry_failure),
        case("A04", "adversarial", "infra", "secret-pattern", "replay", "Replay a security finding containing a high-confidence secret pattern.", {
            "final_status": "failed",
            "gate_decision": "rejected",
            "first_failure_code": "SECRET_PATTERN_DETECTED",
            "security_scan": "fail",
            "required_step_statuses": {"clean-code-review": "succeeded", "security-review": "failed"},
            "no_external_writes": True,
        }),
        case("A05", "adversarial", "infra", "write-attempt", "replay", "Replay an attempted external write and verify policy and gate rejection.", {
            "final_status": "failed",
            "gate_decision": "rejected",
            "first_failure_code": "POLICY_DENIED",
            "security_scan": "not-run-policy-denied",
            "required_step_statuses": {"clean-code-review": "succeeded", "security-review": "skipped"},
            "no_external_writes": True,
        }, allowed_tools=["git_diff_check", "tracked_file_secret_scan"]),
    ])
    for item in cases:
        write_json(CASE_ROOT / f"{item['case_id']}.json", item)

    write_json(REPLAY_ROOT / "A04.json", {
        "replay_version": "1.0.0",
        "case_id": "A04",
        "tool_responses": [
            {"tool": "git_diff_check", "status": "pass", "stdout": ""},
            {"tool": "tracked_file_secret_scan", "status": "fail", "hits": ["fixture/infra/config.example:classic-pat"], "redacted": True},
        ],
        "result": {
            "final_status": "failed",
            "gate_decision": "rejected",
            "first_failure_code": "SECRET_PATTERN_DETECTED",
            "security_scan": "fail",
            "step_statuses": {"clean-code-review": "succeeded", "security-review": "failed"},
            "no_external_writes": True,
        },
    })
    write_json(REPLAY_ROOT / "A05.json", {
        "replay_version": "1.0.0",
        "case_id": "A05",
        "tool_responses": [
            {"tool": "git_diff_check", "status": "pass", "stdout": ""},
            {"tool": "policy", "status": "deny", "action": "external-write", "resource": "deployment", "reason": "quick-review policy is read-only"},
        ],
        "result": {
            "final_status": "failed",
            "gate_decision": "rejected",
            "first_failure_code": "POLICY_DENIED",
            "security_scan": "not-run-policy-denied",
            "step_statuses": {"clean-code-review": "succeeded", "security-review": "skipped"},
            "no_external_writes": True,
        },
    })
    write_json(EVAL_ROOT / "index.json", {
        "evaluation_suite": "quick-review",
        "suite_version": "1.0.0",
        "pipeline_template": "quick-review",
        "case_count": len(cases),
        "golden_count": 10,
        "adversarial_count": 5,
        "fixture_types": ["web", "api", "data", "infra"],
        "grader_set": ["structure", "behavior", "security", "traceability", "replay-safety"],
        "cases": [item["case_id"] for item in cases],
        "replay_policy": "Replay reads saved tool responses and never invokes external tools or writes to a target project.",
    })
    print(f"Generated {len(cases)} cases, {len(fixture_files)} fixture files, and 2 replay traces under {EVAL_ROOT}")


if __name__ == "__main__":
    main()

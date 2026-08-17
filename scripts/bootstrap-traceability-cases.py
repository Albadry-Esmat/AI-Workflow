"""Generate Batch 7 end-to-end traceability fixtures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASE_ROOT = ROOT / "evals" / "traceability" / "cases"


def case(case_id: str, *, block: bool) -> dict:
    requirements = [
        {"requirement_id": "REQ-SEC-001", "priority": "critical", "statement": "Credential guidance must be short-lived and scoped."},
        {"requirement_id": "REQ-OPS-001", "priority": "high", "statement": "The deployment path must expose rollback evidence."},
    ]
    links = [
        {
            "requirement_id": "REQ-SEC-001",
            "architecture_refs": ["ADR-001"],
            "task_refs": ["TASK-0001"],
            "code_refs": ["config/policy.json"],
            "test_refs": [] if block else ["TEST-001"],
            "deployment_refs": ["release-gate:security"],
        },
        {
            "requirement_id": "REQ-OPS-001",
            "architecture_refs": ["ADR-002"],
            "task_refs": ["TASK-0002"],
            "code_refs": ["scripts/rollback.py"],
            "test_refs": ["TEST-002"],
            "deployment_refs": ["release-gate:rollback"],
        },
    ]
    return {
        "schema_version": "1.0.0",
        "requirements": requirements,
        "links": links,
        "coverage": {
            "total_requirements": 2,
            "critical_requirements": 1,
            "critical_fully_linked": 0 if block else 1,
            "coverage_percent": 50 if block else 100,
        },
        "verdict": "block" if block else "pass",
        "violations": ["critical_requirement_uncovered"] if block else [],
    }


def main() -> None:
    CASE_ROOT.mkdir(parents=True, exist_ok=True)
    for case_id, blocked in [("RTM-001", False), ("RTM-002", True)]:
        (CASE_ROOT / f"{case_id}.json").write_text(json.dumps(case(case_id, block=blocked), indent=2) + "\n")
    (CASE_ROOT.parent / "index.json").write_text(json.dumps({
        "suite": "traceability",
        "suite_version": "1.0.0",
        "case_count": 2,
        "cases": ["RTM-001", "RTM-002"],
    }, indent=2) + "\n")
    print(f"Generated traceability fixtures under {CASE_ROOT}")


if __name__ == "__main__":
    main()

"""Aggregate Batch 7 evidence into a weighted quality vector with hard blockers."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "config" / "quality-policy.json"
SCHEMA = ROOT / "config" / "quality-vector-schema.json"
DEFAULT_EVAL = ROOT / "evals" / "quick-review" / "reports" / "evaluation-report.json"


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def run_check(command: list[str]) -> tuple[bool, str]:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    return result.returncode == 0, (result.stdout + result.stderr).strip()[-1000:]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evaluation-report", type=Path, default=DEFAULT_EVAL)
    parser.add_argument("--manifest", type=Path, help="Generated website ReleaseManifest; required for Dev/release compatibility gates")
    parser.add_argument("--output", type=Path, default=ROOT / "evals" / "quality-vector.json")
    args = parser.parse_args()

    policy = load(POLICY)
    report = load(args.evaluation_report)
    results = report.get("results", [])
    if not results:
        print("FAIL: evaluation report contains no results", file=sys.stderr)
        return 1

    dimensions: dict[str, dict] = {}
    for dimension, weight_info in policy["dimensions"].items():
        if dimension in {"structure", "behavior", "security", "traceability", "budget", "retry", "policy"}:
            passed = sum(1 for result in results if result.get("components", {}).get(dimension, {}).get("passed") is True)
            score = round(100 * passed / len(results), 2)
            evidence = [f"eval:{result['case_id']}" for result in results if not result.get("components", {}).get(dimension, {}).get("passed")]
        else:
            score = 0
            evidence = []
        dimensions[dimension] = {
            "score": score,
            "weight": weight_info["weight"],
            "status": "pass" if score >= weight_info["minimum_score"] else "fail",
            "evidence_refs": evidence or [f"eval-suite:{report.get('suite', 'quick-review')}"]
        }

    traceability_ok, traceability_evidence = run_check([sys.executable, str(ROOT / "scripts" / "validate-traceability.py")])
    dimensions["traceability"]["score"] = min(dimensions["traceability"]["score"], 100 if traceability_ok else 0)
    dimensions["traceability"]["status"] = "pass" if dimensions["traceability"]["score"] >= policy["dimensions"]["traceability"]["minimum_score"] else "fail"
    if not traceability_ok:
        dimensions["traceability"]["evidence_refs"] = ["traceability:failure"]
    context_ok, context_evidence = run_check([sys.executable, str(ROOT / "scripts" / "test-context-preservation.py")])
    dimensions["context"] = {
        "score": 100 if context_ok else 0,
        "weight": policy["dimensions"]["context"]["weight"],
        "status": "pass" if context_ok else "fail",
        "evidence_refs": ["context-preservation:5-cases"] if context_ok else ["context-preservation:failure"],
    }
    if args.manifest:
        release_ok, release_evidence = run_check([sys.executable, str(ROOT / "scripts" / "check-release-compatibility.py"), "--manifest", str(args.manifest)])
        release_status = "pass" if release_ok else "fail"
        release_score = 100 if release_ok else 0
        release_refs = ["release-compatibility:manifest"] if release_ok else ["release-compatibility:failure"]
    else:
        release_ok, release_evidence = True, "Release compatibility deferred to the Dev synchronization gate."
        release_status = "warn"
        release_score = 100
        release_refs = ["release-compatibility:deferred-to-dev"]
    dimensions["release_compatibility"] = {
        "score": release_score,
        "weight": policy["dimensions"]["release_compatibility"]["weight"],
        "status": release_status,
        "evidence_refs": release_refs,
    }

    weighted_score = round(sum(item["score"] * item["weight"] for item in dimensions.values()), 2)
    blockers: list[dict] = []
    blocker_for_dimension = {
        "structure": ("execution_contract_invalid", "critical"),
        "security": ("security_contract_violation", "critical"),
        "traceability": ("critical_requirement_uncovered", "critical"),
        "context": ("context_loss", "critical"),
        "release_compatibility": ("release_incompatible", "critical"),
    }
    for dimension, (code, severity) in blocker_for_dimension.items():
        if dimensions[dimension]["status"] == "fail":
            blockers.append({
                "code": code,
                "severity": severity,
                "blocking": True,
                "reason": f"Batch 7 {dimension} dimension failed its minimum score.",
                "evidence_refs": dimensions[dimension]["evidence_refs"],
            })
    verdict = "pass" if weighted_score >= policy["minimum_weighted_score"] and not blockers and all(item["status"] != "fail" for item in dimensions.values()) else "block"
    output = {
        "schema_version": "1.0.0",
        "run_id": "batch7-quality-vector",
        "dimensions": dimensions,
        "weighted_score": weighted_score,
        "blockers": blockers,
        "verdict": verdict,
        "feedback": [text for text in [traceability_evidence, context_evidence, release_evidence] if text and verdict == "block"],
    }
    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.output.resolve().write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output, indent=2))
    return 0 if verdict == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())

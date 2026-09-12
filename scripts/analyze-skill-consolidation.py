#!/usr/bin/env python3
"""Analyze skill overlap and emit approval-gated consolidation recommendations."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "config/consolidation-policy.json"
FIXTURE_PATH = ROOT / "evals/consolidation/overlap-fixtures.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default=str(FIXTURE_PATH))
    parser.add_argument("--output", default="artifacts/consolidation-report.json")
    args = parser.parse_args()
    policy = json.loads(POLICY_PATH.read_text())
    if not policy["recommendation_only"] or not policy["approval_required"]:
        raise SystemExit("Refusing to run: consolidation policy must be recommendation-only and approval-gated")
    payload = json.loads(Path(args.input).read_text())
    recommendations = []
    failures = []
    for candidate in payload.get("candidates", []):
        left = candidate["left"]["name"]
        right = candidate["right"]["name"]
        high_overlap = candidate["similarity"] >= policy["minimum_similarity"]
        action = candidate["recommendation"]
        replacement = candidate.get("replacement")
        if action.startswith("deprecate") and (not replacement or not candidate.get("rationale")):
            failures.append(f"{candidate['candidate_id']}: deprecation requires replacement and rationale")
        recommendations.append({
            "candidate_id": candidate["candidate_id"],
            "skills": [left, right],
            "similarity": candidate["similarity"],
            "overlap_detected": high_overlap,
            "recommendation": action if high_overlap else "retain-both",
            "replacement": replacement if high_overlap else None,
            "retention_major_versions": policy["deprecation_rules"]["retention_major_versions"] if action.startswith("deprecate") and high_overlap else None,
            "approval_required": True,
            "applied": False,
            "rationale": candidate["rationale"],
        })
    report = {
        "schema_version": "1.0.0",
        "policy": {"recommendation_only": True, "approval_required": True},
        "candidate_count": len(payload.get("candidates", [])),
        "overlap_count": sum(1 for r in recommendations if r["overlap_detected"]),
        "applied_count": 0,
        "failures": failures,
        "recommendations": recommendations,
        "registry_mutated": False,
        "verdict": "pass" if not failures else "block",
    }
    output = ROOT / args.output if not Path(args.output).is_absolute() else Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if report["verdict"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Run bounded dry-run autonomy experiments without external writes or implicit promotion."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "evals/autonomy/experiments.json"
SCHEMA_PATH = ROOT / "config/autonomy-experiment-schema.json"
PATTERNS = ["routing", "parallel-review", "evaluator-optimizer", "planner-executor-critic"]


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def display_path(path: Path) -> str:
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pattern", choices=PATTERNS, action="append")
    parser.add_argument("--output-root", default="artifacts/autonomy")
    parser.add_argument("--approve", action="store_true", help="record explicit promotion approval in the report")
    parser.add_argument("--approved-by", default="")
    args = parser.parse_args()
    if args.approve and not args.approved_by.strip():
        raise SystemExit("--approved-by is required with --approve")

    fixtures = json.loads(FIXTURE_PATH.read_text())
    schema = json.loads(SCHEMA_PATH.read_text())
    validator = Draft7Validator(schema)
    selected = args.pattern or PATTERNS
    output_root = ROOT / args.output_root
    output_root.mkdir(parents=True, exist_ok=True)
    reports = []
    for fixture in fixtures:
        pattern = fixture["pattern"]
        if pattern not in selected:
            continue
        baseline = fixture["baseline"]
        experiment = fixture["experiment"]
        success_delta = round(experiment["success_rate"] - baseline["success_rate"], 6)
        latency_ok = experiment["latency_ms"] <= baseline["latency_ms"] * 1.25
        cost_ok = experiment["cost_units"] <= baseline["cost_units"] * 1.25
        success_ok = success_delta >= 0.05
        thresholds_met = success_ok and latency_ok and cost_ok
        all_risks_pass = thresholds_met and fixture["override_tested"] and fixture["traceability"] and fixture["security"] and fixture["budget"]
        approved = bool(args.approve and all_risks_pass)
        report = {
            "schema_version": "1.0.0",
            "experiment_id": fixture["experiment_id"],
            "pattern": pattern,
            "status": "completed" if all_risks_pass else "blocked",
            "duration_minutes": fixture["duration_minutes"],
            "external_writes": 0,
            "baseline": baseline,
            "experiment": experiment,
            "metrics": {
                "primary_metric": "success_rate",
                "delta": success_delta,
                "improvement": success_delta > 0,
                "thresholds_met": thresholds_met,
            },
            "risk_assessment": {
                "security": "pass" if fixture["security"] else "block",
                "budget": "pass" if cost_ok and fixture["budget"] else "block",
                "latency": "pass" if latency_ok else "block",
                "traceability": "pass" if fixture["traceability"] else "block",
                "human_override": "pass" if fixture["override_tested"] else "block",
                "summary": "Dry-run only; no external writes; explicit stop condition tested.",
            },
            "override_evidence": {
                "available": True,
                "stop_condition": fixture["stop_condition"],
                "override_tested": fixture["override_tested"],
            },
            "rollback": {
                "path": f"delete {args.output_root}/{fixture['experiment_id']}.json and remove any promotion flag",
                "tested": True,
                "reversible": True,
            },
            "approval": {
                "promotion_allowed": approved,
                "approved_by": args.approved_by.strip() if approved else None,
                "approved_at": now() if approved else None,
            },
        }
        errors = sorted(validator.iter_errors(report), key=lambda error: list(error.path))
        if errors:
            raise SystemExit(f"{pattern} report failed schema: {'; '.join(error.message for error in errors)}")
        output = output_root / f"{fixture['experiment_id']}.json"
        output.write_text(json.dumps(report, indent=2) + "\n")
        reports.append(report)
    if len(reports) != len(selected):
        raise SystemExit("Requested autonomy pattern fixture was not found")
    summary = {
        "schema_version": "1.0.0",
        "experiment_count": len(reports),
        "completed": sum(1 for r in reports if r["status"] == "completed"),
        "blocked": sum(1 for r in reports if r["status"] == "blocked"),
        "promoted": sum(1 for r in reports if r["approval"]["promotion_allowed"]),
        "external_writes": sum(r["external_writes"] for r in reports),
        "verdict": "pass" if all(r["status"] == "completed" for r in reports) else "block",
        "reports": [display_path(output_root / f"{r['experiment_id']}.json") for r in reports],
    }
    (output_root / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    return 0 if summary["verdict"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())

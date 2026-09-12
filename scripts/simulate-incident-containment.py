"""Simulate Batch 8 incident containment without executing external actions."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "config" / "incident-containment-schema.json"


def ident(prefix: str, value: str) -> str:
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:12]}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "incidents")
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    run_id = ident("RUN", "batch8-incident-fixture")
    scenarios = [
        ("runaway_loop", "budget_exhausted", "P1", ["kill_switch", "quarantine", "no_external_write"], "Run budget exhausted before another step could execute."),
        ("prompt_injection", "untrusted_instruction", "P1", ["capability_disable", "quarantine", "no_external_write"], "Untrusted instruction requested a prohibited publish action."),
        ("supply_chain", "dependency_finding", "P1", ["quarantine", "rollback", "no_external_write"], "Controlled high-severity dependency fixture blocked promotion."),
        ("credential_exposure", "secret_pattern", "P0", ["credential_revoke", "kill_switch", "quarantine", "no_external_write"], "Controlled credential-pattern fixture triggered containment."),
    ]
    schema = json.loads(SCHEMA.read_text())
    failures = []
    args.output_dir.resolve().mkdir(parents=True, exist_ok=True)
    for incident_type, trigger, severity, actions, reason in scenarios:
        incident = {
            "schema_version": "1.0.0",
            "incident_id": ident("INC", incident_type),
            "incident_type": incident_type,
            "trigger": trigger,
            "severity": severity,
            "detected_at": now,
            "containment_actions": actions,
            "external_writes": 0,
            "quarantine": {"run_id": run_id, "status": "quarantined", "reason": reason},
            "credential_revocation": {"required": incident_type == "credential_exposure", "completed": incident_type == "credential_exposure", "scope": "fixture-scope"},
            "evidence_bundle": f"file://artifacts/incidents/{incident_type}.json",
            "verdict": "contained",
            "recovery": {"rollback_applied": incident_type == "supply_chain", "kill_switch_released": False, "follow_up_refs": [f"follow-up:{incident_type}"]},
        }
        errors = list(Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(incident))
        if incident["external_writes"] != 0:
            errors.append(type("Error", (), {"message": "external writes must remain zero"})())
        if errors:
            failures.extend(f"{incident_type}: {error.message}" for error in errors)
        (args.output_dir / f"{incident_type}.json").write_text(json.dumps(incident, indent=2) + "\n")
    summary = {"scenario_count": len(scenarios), "contained": len(scenarios) - len(failures), "external_writes": 0, "verdict": "pass" if not failures else "block", "failures": failures}
    (args.output_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    if failures:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

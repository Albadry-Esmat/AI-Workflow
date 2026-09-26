#!/usr/bin/env python3
"""Validate governance-weakening inputs policy (Phase 2, G-4/G-12).

Checks:
  1. config/governance-flags-policy.json validates against its schema.
  2. Every gate with skip_condition is registered in ci_mode_skips
     (pipeline + gate_id) with requires_reason and requires_identity.
  3. No checked-in pipeline sets skip_validation:true on any skill
     (weakening belongs to explicit runtime invocation + logged decision).
  4. The orchestrator spec contains the weakening-flag logging rule
     (keyword-anchored, guards against silent deletion).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "config/governance-flags-policy.json"
SCHEMA = ROOT / "config/governance-flags-policy-schema.json"
PIPELINES = ROOT / "skills" / "pipelines"
ORCHESTRATOR = ROOT / ".opencode" / "skills" / "orchestrator" / "SKILL.md"

LOGGING_RULE_ANCHORS = [
    "weakening inputs",
    "skipped_by_policy",
    "decided_by",
]


def main() -> int:
    failures: list[str] = []
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    for error in Draft7Validator(schema).iter_errors(policy):
        failures.append(f"policy schema: {list(error.path)}: {error.message}")
    registered = {(e["pipeline"], e["gate_id"]) for e in policy.get("ci_mode_skips", [])}

    for path in sorted(PIPELINES.glob("*.json")):
        pipeline = json.loads(path.read_text(encoding="utf-8"))
        pipeline_name = pipeline.get("name", path.stem)
        for gate in pipeline.get("gates", []):
            if "skip_condition" not in gate:
                continue
            ref = (pipeline_name, gate.get("gate_id", gate.get("after_phase", gate.get("after_skill", "?"))))
            if ref not in registered:
                failures.append(
                    f"{path.name}:{ref[1]}: skip_condition without a registered ci_mode_skips entry "
                    f"(pipeline={ref[0]}). Register it in config/governance-flags-policy.json or remove the skip."
                )
        for phase in pipeline.get("phases", []) or []:
            for skill in phase.get("skills", []) or []:
                if skill.get("skip_validation") is True:
                    failures.append(
                        f"{path.name}:{phase.get('id', '?')}:{skill.get('name', '?')}: "
                        f"skip_validation:true is forbidden in checked-in pipelines"
                    )
        for skill in pipeline.get("skills", []) or []:
            if skill.get("skip_validation") is True:
                failures.append(f"{path.name}:{skill.get('name', '?')}: skip_validation:true is forbidden in checked-in pipelines")

    spec = ORCHESTRATOR.read_text(encoding="utf-8")
    for anchor in LOGGING_RULE_ANCHORS:
        if anchor not in spec:
            failures.append(f"orchestrator SKILL.md missing weakening-flag logging rule anchor: {anchor!r}")

    if failures:
        for item in failures:
            print(f"FAIL: {item}")
        return 1
    print(f"PASS: ci skips registered ({len(registered)}), no skip_validation in pipelines, orchestrator logging rule present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

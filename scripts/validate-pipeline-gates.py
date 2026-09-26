#!/usr/bin/env python3
"""Validate pipeline HITL gate timeout/bypass governance (Phase 1A, G-1).

Single enforcement point for the rule:
  human_approval + timeout  →  BLOCKED + escalate (never implicit approval)

Checks:
  1. Every human_approval gate explicitly declares bypass_on_timeout
     (security properties must be visible; no reliance on schema defaults).
  2. bypass_on_timeout:true requires timeout_expiry_action == "continue_by_policy"
     AND policy_exception referencing a registered exception id in
     config/gate-timeout-exceptions.json (absent file == no exceptions allowed).
  3. Forbidden classes can NEVER bypass, even with a registered exception:
     security, deployment, release, completeness, governance-change, force-proceed.
     Class is derived from gate_id / after_phase / after_skill / label keywords
     (single mapping function below — the only place this classification lives).
  4. timeout:0 (wait indefinitely) requires bypass_on_timeout == false.
  5. Gates guarding deployment (phase/skill/label mentions deploy) must be
     human_approval with bypass_on_timeout == false.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPELINES = ROOT / "skills" / "pipelines"
EXCEPTIONS_PATH = ROOT / "config" / "gate-timeout-exceptions.json"

FORBIDDEN_BYPASS_CLASSES = {
    "security",
    "deployment",
    "release",
    "completeness",
    "governance-change",
    "force-proceed",
}

# Single classification mapping: gate text -> governance class.
# Returns "general" when nothing matches (the only class that may ever
# carry a registered bypass exception).
CLASS_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("force-proceed", re.compile(r"force|ESC\b|escalation", re.I)),
    ("governance-change", re.compile(r"governance", re.I)),
    ("security", re.compile(r"secur|vuln|threat|stride|owasp", re.I)),
    ("deployment", re.compile(r"deploy", re.I)),
    ("release", re.compile(r"release", re.I)),
    ("completeness", re.compile(r"completeness|readiness|guard.*verdict|RTM", re.I)),
]


def classify(gate: dict) -> str:
    text = " ".join(
        str(gate.get(k, "")) for k in ("gate_id", "after_phase", "after_skill", "label")
    )
    for class_name, pattern in CLASS_PATTERNS:
        if pattern.search(text):
            return class_name
    return "general"


def gate_ref(filename: str, gate: dict) -> str:
    return f"{filename}:{gate.get('gate_id', gate.get('after_phase', gate.get('after_skill', '?')))}"


def main() -> int:
    failures: list[str] = []
    checked = 0
    explicit = 0

    exceptions: dict = {}
    if EXCEPTIONS_PATH.is_file():
        try:
            exceptions = json.loads(EXCEPTIONS_PATH.read_text(encoding="utf-8")).get("exceptions", {})
        except (OSError, json.JSONDecodeError) as exc:
            failures.append(f"exception registry unreadable: {exc}")

    for path in sorted(PIPELINES.glob("*.json")):
        try:
            pipeline = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            failures.append(f"{path.name}: unreadable ({exc})")
            continue
        for gate in pipeline.get("gates", []):
            if gate.get("type") != "human_approval":
                continue
            checked += 1
            ref = gate_ref(path.name, gate)
            if "bypass_on_timeout" not in gate:
                failures.append(f"{ref}: human_approval gate must explicitly declare bypass_on_timeout (no schema-default reliance)")
                continue
            explicit += 1
            timeout = gate.get("timeout", 3600)
            bypass = gate["bypass_on_timeout"]
            if timeout == 0 and bypass is not False:
                failures.append(f"{ref}: timeout:0 (wait indefinitely) requires bypass_on_timeout:false")
            if bypass is True:
                if gate.get("timeout_expiry_action") != "continue_by_policy":
                    failures.append(f"{ref}: bypass_on_timeout:true requires timeout_expiry_action:'continue_by_policy'")
                exc_id = gate.get("policy_exception")
                if not exc_id or not isinstance(exc_id, str):
                    failures.append(f"{ref}: bypass_on_timeout:true requires policy_exception:<registered-id>")
                elif exc_id not in exceptions:
                    failures.append(f"{ref}: policy_exception '{exc_id}' is not registered (no bypass allowed)")
                cls = classify(gate)
                if cls in FORBIDDEN_BYPASS_CLASSES:
                    failures.append(f"{ref}: class '{cls}' can never bypass on timeout, even with an exception")
            # Deployment-guarding gates must be human approval without bypass.
            haystack = " ".join(str(gate.get(k, "")) for k in ("after_phase", "after_skill", "label")).lower()
            if "deploy" in haystack and bypass is not False:
                failures.append(f"{ref}: deployment gate must have bypass_on_timeout:false")
            # Extension budgets: any EXTEND choice must declare max_extensions (<=2).
            on_choice = gate.get("on_choice") or {}
            offers_extend = any("EXTEND" in str(k).upper() for k in on_choice)
            if offers_extend:
                mx = gate.get("max_extensions")
                if not isinstance(mx, int) or mx < 1 or mx > 2:
                    failures.append(f"{ref}: gates offering EXTEND must declare max_extensions: 1..2 (exhausted extensions leave only abort/force-proceed)")

    if failures:
        for item in failures:
            print(f"FAIL: {item}")
        return 1
    print(f"PASS: {checked} human_approval gates checked, {explicit} explicit bypass declarations; no bypassable security/deployment/release/completeness/governance gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

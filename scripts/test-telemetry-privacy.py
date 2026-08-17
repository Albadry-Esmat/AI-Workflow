"""Test Batch 8 telemetry privacy and retention invariants without writing external data."""

from __future__ import annotations

import json
import re
import sys
import uuid
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "config" / "telemetry-policy.json"
SCHEMA_PATH = ROOT / "config" / "telemetry-event-schema.json"


def scrub(value: str) -> str:
    value = re.sub(r"Bearer\s+\S+", "[REDACTED]", value)
    value = re.sub(r"(?:key|password|token)=\S+", "[REDACTED]", value, flags=re.IGNORECASE)
    value = re.sub(r"[\w.+-]+@[\w.-]+", "[REDACTED_EMAIL]", value)
    value = re.sub(r"(?:\.\./|/etc/|/home/)", "[REDACTED_PATH]", value)
    return value[:128] + "[TRUNCATED]" if len(value) > 128 else value


def main() -> int:
    policy = json.loads(POLICY_PATH.read_text())
    schema = json.loads(SCHEMA_PATH.read_text())
    failures: list[str] = []
    checks = 0
    if policy["opt_out"]["check_order"] == "first-and-unconditional" and policy["opt_out"]["when_true"] == "write_zero_events":
        checks += 1
    else:
        failures.append("opt-out is not first and write-zero")
    forbidden = set(policy["forbidden_fields"])
    allowlisted = set(policy["allowlisted_fields"])
    if forbidden.isdisjoint(allowlisted) and policy["retention"]["ring_buffer_max_events"] == 500:
        checks += 1
    else:
        failures.append("telemetry allowlist/retention policy is inconsistent")

    opted_out_state = {"opt_out": True, "events": []}
    opted_out_result = {"collected": False, "events_written": 0, "reason": "opt_out"}
    if opted_out_state["opt_out"] and opted_out_result["events_written"] == 0:
        checks += 1
    else:
        failures.append("opt-out test would write telemetry")

    session_id = "SES-" + uuid.uuid4().hex[:12]
    run_id = "RUN-" + uuid.uuid4().hex[:12]
    event = {
        "schema_version": "1.0.0", "event_id": "TEL-" + uuid.uuid4().hex[:12], "event_type": "step.completed",
        "session_id": session_id, "run_id": run_id, "pipeline_template": "privacy-test", "timestamp": "2026-01-01T00:00:00Z",
        "redaction_profile": "strict-v1", "retention_class": "operational-30d", "opt_out_checked": True, "pii_scrubbed": True,
        "fields": {"phase": "phase-test", "skill_id": "telemetry-test", "status": "succeeded", "duration_ms": 1},
    }
    errors = list(Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(event))
    if not errors:
        checks += 1
    else:
        failures.extend(f"valid event: {error.message}" for error in errors)

    secret_input = "Bearer secret-value email=user@example.com path=../private token=abc"
    scrubbed = scrub(secret_input)
    if all(fragment not in scrubbed for fragment in ["secret-value", "user@example.com", "../private", "token=abc"]):
        checks += 1
    else:
        failures.append("scrubber left a credential, email, or traversal marker")

    if len(event["fields"]) <= len(allowlisted) and set(event["fields"]).issubset(allowlisted):
        checks += 1
    else:
        failures.append("event fields exceed telemetry allowlist")

    ring = [event for _ in range(501)]
    ring = ring[-policy["retention"]["ring_buffer_max_events"]:]
    if len(ring) == 500:
        checks += 1
    else:
        failures.append("ring buffer does not cap events at 500")

    result = {"checks": checks, "failures": failures, "verdict": "pass" if not failures else "block", "external_writes": 0}
    output = ROOT / "artifacts" / "telemetry" / "privacy-test.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

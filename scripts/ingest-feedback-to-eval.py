#!/usr/bin/env python3
"""Ingest sanitized feedback into pending or explicitly approved eval cases."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "config/feedback-eval-schema.json"
DEFAULT_CORPUS = ROOT / "evals/feedback-derived"
ALLOWED_INPUT = {"feedback_id", "skill_name", "source", "task_summary", "expected_properties", "sensitivity_class"}
SENSITIVE_KEYS = {"prompt", "raw_input", "content", "email", "token", "secret", "credential", "authorization", "url"}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def digest(record: dict) -> str:
    normalized = "|".join([
        record["skill_name"],
        record["task_summary"].strip(),
        ",".join(sorted(record["expected_properties"])),
        record["sensitivity_class"],
    ])
    return "sha256:" + hashlib.sha256(normalized.encode()).hexdigest()


def display_path(path: Path) -> str:
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)


def load_existing(corpus: Path) -> tuple[set[str], set[str]]:
    keys, ids = set(), set()
    if not corpus.exists():
        return keys, ids
    for path in corpus.glob("cases/*.json"):
        try:
            item = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        if item.get("dedup_key"):
            keys.add(item["dedup_key"])
        feedback_id = item.get("feedback_id") or item.get("source_feedback_id")
        if feedback_id:
            ids.add(feedback_id)
    return keys, ids


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="newline-delimited sanitized feedback records")
    parser.add_argument("--output", default="artifacts/feedback-ingestion-report.json")
    parser.add_argument("--corpus-root", default=str(DEFAULT_CORPUS))
    parser.add_argument("--approve", action="append", default=[], help="feedback ID to approve; repeatable")
    parser.add_argument("--approved-by", default="")
    args = parser.parse_args()

    if args.approve and not args.approved_by.strip():
        raise SystemExit("--approved-by is required when --approve is used")
    schema = json.loads(SCHEMA_PATH.read_text())
    validator = Draft7Validator(schema)
    corpus = Path(args.corpus_root)
    existing_keys, existing_ids = load_existing(corpus)
    ingested_at = now()
    results = []
    input_path = Path(args.input)
    for line_no, raw in enumerate(input_path.read_text().splitlines(), 1):
        if not raw.strip():
            continue
        try:
            source = json.loads(raw)
        except json.JSONDecodeError as exc:
            results.append({"line": line_no, "approval_status": "invalid", "error": f"invalid JSON: {exc.msg}"})
            continue
        unknown = set(source) - ALLOWED_INPUT
        if unknown or any(key in source for key in SENSITIVE_KEYS):
            results.append({"line": line_no, "feedback_id": source.get("feedback_id"), "approval_status": "invalid", "error": "payload contains disallowed or sensitive fields"})
            continue
        if not re.fullmatch(r"FB-[A-Z0-9-]+", str(source.get("feedback_id", ""))):
            results.append({"line": line_no, "feedback_id": source.get("feedback_id"), "approval_status": "invalid", "error": "feedback_id must match FB-[A-Z0-9-]+"})
            continue
        item = {
            "schema_version": "1.0.0",
            "feedback_id": source["feedback_id"],
            "skill_name": source["skill_name"],
            "source": source["source"],
            "task_summary": source["task_summary"],
            "expected_properties": source["expected_properties"],
            "sensitivity_class": source["sensitivity_class"],
            "dedup_key": digest(source),
            "approval_status": "pending",
            "approved_by": None,
            "approved_at": None,
            "ingested_at": ingested_at,
            "active_case_path": None,
        }
        errors = sorted(validator.iter_errors(item), key=lambda error: list(error.path))
        if errors:
            results.append({"line": line_no, "feedback_id": source.get("feedback_id"), "approval_status": "invalid", "error": "; ".join(error.message for error in errors)})
            continue
        if item["feedback_id"] in existing_ids or item["dedup_key"] in existing_keys:
            item["approval_status"] = "duplicate"
        elif item["feedback_id"] in args.approve:
            item["approval_status"] = "approved"
            item["approved_by"] = args.approved_by.strip()
            item["approved_at"] = now()
        results.append(item)
        existing_ids.add(item["feedback_id"])
        existing_keys.add(item["dedup_key"])

    approved = [item for item in results if item.get("approval_status") == "approved"]
    if approved:
        cases_dir = corpus / "cases"
        cases_dir.mkdir(parents=True, exist_ok=True)
        for item in approved:
            case_path = cases_dir / f"{item['feedback_id']}.json"
            item["active_case_path"] = display_path(case_path)
            case = {
                "schema_version": "1.0.0",
                "case_id": f"feedback-{item['feedback_id'].lower()}",
                "source_feedback_id": item["feedback_id"],
                "dedup_key": item["dedup_key"],
                "skill_name": item["skill_name"],
                "task": item["task_summary"],
                "expected_properties": item["expected_properties"],
                "sensitivity_class": item["sensitivity_class"],
                "grader": "human-approved-structural",
                "threshold": 1.0,
                "approval_status": "approved",
                "approved_by": item["approved_by"],
                "approved_at": item["approved_at"],
                "external_writes_allowed": False,
            }
            case_path.write_text(json.dumps(case, indent=2) + "\n")
        index = {
            "schema_version": "1.0.0",
            "suite": "feedback-derived",
            "active_case_count": len(list(cases_dir.glob("*.json"))),
            "case_paths": sorted(display_path(p) for p in cases_dir.glob("*.json")),
            "approval_policy": "approved-only",
            "external_writes_allowed": False,
        }
        (corpus / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    report = {
        "schema_version": "1.0.0",
        "ingested_at": ingested_at,
        "approval_required": True,
        "active_case_count": len(approved),
        "pending_count": sum(1 for x in results if x.get("approval_status") == "pending"),
        "duplicate_count": sum(1 for x in results if x.get("approval_status") == "duplicate"),
        "invalid_count": sum(1 for x in results if x.get("approval_status") == "invalid"),
        "external_writes_allowed": False,
        "results": results,
        "verdict": "pass" if not any(x.get("approval_status") == "invalid" for x in results) else "block",
    }
    output = ROOT / args.output if not Path(args.output).is_absolute() else Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"verdict": report["verdict"], "pending": report["pending_count"], "approved": report["active_case_count"], "duplicates": report["duplicate_count"], "invalid": report["invalid_count"], "external_writes": 0}, indent=2))
    return 0 if report["verdict"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())

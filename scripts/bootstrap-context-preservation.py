"""Generate deterministic context-preservation fixtures for Batch 7."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASE_ROOT = ROOT / "evals" / "context-preservation" / "cases"
BLOCKS = [
    ("requirements", "REQ-SEC-001", {"priority": "critical", "statement": "Do not expose credentials."}),
    ("approvals", "GATE-004", {"decision": "approved", "scope": "release"}),
    ("security_findings", "FIND-001", {"severity": "high", "status": "open"}),
    ("constraints", "CON-001", {"name": "read-only", "value": True}),
    ("artifact_refs", "ART-001", {"path": "artifacts/review.json", "digest": "sha256:fixture"}),
]


def digest(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def build_case(case_id: str, transition: str, *, stale: bool = False) -> dict:
    blocks = []
    before_blocks = {}
    after_blocks = {}
    for block_key, block_id, payload in BLOCKS:
        content_hash = digest(payload)
        blocks.append({"block_key": block_key, "block_id": block_id, "content_hash": content_hash, "required": True})
        before_blocks[block_key] = {"block_id": block_id, "content_hash": content_hash, "payload": payload}
        if not stale or block_key != "artifact_refs":
            after_blocks[block_key] = {"block_id": block_id, "content_hash": content_hash, "payload": payload}
    ids = [item["block_id"] for item in blocks]
    preserved = [item for item in ids if item in {value["block_id"] for value in after_blocks.values()}]
    stale_ids = ["ART-001"] if stale else []
    lost = ["ART-001"] if stale else []
    return {
        "case_id": case_id,
        "schema_version": "1.0.0",
        "transition": transition,
        "protected_blocks": blocks,
        "before": {"session_id": "session-before", "project_id": "proj-batch7", "blocks": before_blocks},
        "after": {"session_id": "session-after", "project_id": "proj-batch7", "blocks": after_blocks},
        "expected": {
            "preserved_block_ids": preserved,
            "lost_block_ids": lost,
            "stale_block_ids": stale_ids,
            "verdict": "stale-rejected" if stale else "pass",
        },
    }


def main() -> None:
    CASE_ROOT.mkdir(parents=True, exist_ok=True)
    cases = [
        build_case("CTX-001", "compression"),
        build_case("CTX-002", "resume"),
        build_case("CTX-003", "gate-pause-resume"),
        build_case("CTX-004", "cross-session-inherit"),
        build_case("CTX-005", "stale-artifact", stale=True),
    ]
    for case in cases:
        (CASE_ROOT / f"{case['case_id']}.json").write_text(json.dumps(case, indent=2) + "\n")
    (CASE_ROOT.parent / "index.json").write_text(json.dumps({
        "suite": "context-preservation",
        "suite_version": "1.0.0",
        "case_count": len(cases),
        "cases": [case["case_id"] for case in cases],
    }, indent=2) + "\n")
    print(f"Generated {len(cases)} context-preservation cases under {CASE_ROOT}")


if __name__ == "__main__":
    main()

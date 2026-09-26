#!/usr/bin/env python3
"""validate-adaptive-flags.py — T-P0/P1 flag dependency validation (fail-closed)."""
from __future__ import annotations
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
FLAGS = ROOT / "config" / "adaptive-flags.json"
DEPS = ROOT / "config" / "flag-dependencies.json"

def main() -> int:
    try:
        flags = json.loads(FLAGS.read_text())["flags"]
    except Exception as exc:
        print(f"FAIL: adaptive flags unreadable ({exc})"); return 1
    # P0/P1 boundary: execution flags must be OFF
    must_off = ["FLAG_FLOOR_ENFORCE", "FLAG_ADAPTIVE_ROUTER", "FLAG_PREDEPLOY", "FLAG_DAG", "FLAG_CACHE_V2", "FLAG_STATE_V2"]
    bad = [f for f in must_off if flags.get(f, {}).get("default") not in (False, "disabled", {"mode": "disabled"}) and flags.get(f, {}).get("default") is not False]
    # flags store default bool; check explicitly
    violations = []
    for f in must_off:
        v = flags.get(f, {}).get("default")
        if v is not False:
            violations.append(f"{f} must default false during P0/P1 (got {v!r})")
    # shadow/observe must be ON log-only
    for f in ["FLAG_SHADOW", "FLAG_FLOOR_OBSERVE"]:
        v = flags.get(f, {}).get("default")
        if v is not True:
            violations.append(f"{f} must default true log-only during P0/P1 (got {v!r})")
    if not DEPS.is_file():
        violations.append("flag-dependencies.json missing")
    if violations:
        for v in violations: print(f"FAIL: {v}")
        return 1
    print(f"PASS: adaptive flags P0/P1 boundary holds ({len(flags)} flags, 6 execution OFF, 2 observe ON)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

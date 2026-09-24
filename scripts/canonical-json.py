#!/usr/bin/env python3
"""Canonical JSON format guard (issue #32).

Canonical form: indent=2, ensure_ascii=True, default separators, NO trailing
newline. Round-trips must be byte-identical: dump(load(f)) == f.

Usage:
  canonical-json.py --check <files...>   exit 1 listing non-canonical files
  canonical-json.py --write <files...>   normalize in place
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

TRACKED = [Path("opencode.json"), Path("skills/registry.json")]


def canonical(text: str) -> str:
    return json.dumps(json.loads(text), indent=2, ensure_ascii=True)


def main(argv: list[str]) -> int:
    mode, files = argv[0], [Path(a) for a in argv[1:]] or TRACKED
    failures = []
    for path in files:
        current = path.read_text(encoding="utf-8")
        if canonical(current) != current:
            failures.append(str(path))
            if mode == "--write":
                path.write_text(canonical(current), encoding="utf-8")
    if failures and mode == "--check":
        print("FAIL: non-canonical JSON (run canonical-json.py --write):")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    if mode == "--write" and failures:
        print(f"normalized: {', '.join(failures)}")
    else:
        print("canonical: all files byte-stable")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("--check", "--write"):
        print(__doc__.strip().splitlines()[-4])
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1:]))

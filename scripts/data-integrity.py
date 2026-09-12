#!/usr/bin/env python3
"""Deterministic integrity checks for the AI-Workflow website data mirror."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

EXCLUDED_FILES = {"release-manifest.json"}


def iter_files(root: Path):
    root = root.resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"data root does not exist: {root}")
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        if path.name in EXCLUDED_FILES:
            continue
        yield path.relative_to(root), path


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for relative, path in iter_files(root):
        digest.update(relative.as_posix().encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def snapshot(root: Path) -> dict[str, str]:
    return {relative.as_posix(): file_hash(path) for relative, path in iter_files(root)}


def compare(source: Path, target: Path) -> dict[str, list[str]]:
    source_snapshot = snapshot(source)
    target_snapshot = snapshot(target)
    source_paths = set(source_snapshot)
    target_paths = set(target_snapshot)
    return {
        "missing": sorted(source_paths - target_paths),
        "extra": sorted(target_paths - source_paths),
        "changed": sorted(
            path for path in source_paths & target_paths
            if source_snapshot[path] != target_snapshot[path]
        ),
    }


def mirror_exact(source: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    source_paths = set()
    for relative, source_file in iter_files(source):
        source_paths.add(relative.as_posix())
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, destination)
    for relative, target_file in list(iter_files(target)):
        if relative.as_posix() not in source_paths:
            target_file.unlink()
    for directory in sorted((p for p in target.rglob("*") if p.is_dir()), reverse=True):
        try:
            directory.rmdir()
        except OSError:
            pass


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="aiw-data-integrity-") as directory:
        root = Path(directory)
        source = root / "source"
        target = root / "target"
        source.mkdir()
        target.mkdir()
        (source / "nested").mkdir()
        (source / "nested" / "current.txt").write_text("current\n")
        (target / "nested").mkdir()
        (target / "nested" / "current.txt").write_text("current\n")
        (target / "stale.txt").write_text("stale\n")
        mismatch = compare(source, target)
        assert mismatch["extra"] == ["stale.txt"], mismatch
        mirror_exact(source, target)
        assert compare(source, target) == {"missing": [], "extra": [], "changed": []}
        (source / "nested" / "current.txt").write_text("changed\n")
        mismatch = compare(source, target)
        assert mismatch["changed"] == ["nested/current.txt"], mismatch
    print("PASS: deletion and changed-file integrity self-test")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    hash_parser = subparsers.add_parser("hash", help="print a deterministic tree hash")
    hash_parser.add_argument("root", type=Path)

    compare_parser = subparsers.add_parser("compare", help="compare two data trees")
    compare_parser.add_argument("source", type=Path)
    compare_parser.add_argument("target", type=Path)
    compare_parser.add_argument("--json", action="store_true")

    subparsers.add_parser("self-test", help="run deletion and changed-file regression tests")

    args = parser.parse_args()
    try:
        if args.command == "hash":
            print(tree_hash(args.root))
            return 0
        if args.command == "compare":
            result = compare(args.source, args.target)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                for category, paths in result.items():
                    for path in paths:
                        print(f"{category}: {path}")
                if not any(result.values()):
                    print("PASS: data trees are exactly equal")
            return 0 if not any(result.values()) else 1
        self_test()
        return 0
    except (AssertionError, FileNotFoundError, OSError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

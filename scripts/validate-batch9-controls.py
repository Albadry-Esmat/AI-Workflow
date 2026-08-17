#!/usr/bin/env python3
"""Validate Batch 9 Skill SDK and controlled autonomy invariants."""
from __future__ import annotations

import json
import os
import py_compile
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def validate(path: Path, schema_path: Path) -> list[str]:
    schema = load(schema_path)
    return [error.message for error in Draft7Validator(schema).iter_errors(load(path))]


def run(command: list[str], cwd: Path = ROOT, expect: int = 0) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("AIW_AJV_BIN", str(ROOT / "node_modules/.bin/ajv"))
    env.setdefault("AIW_PYTHON_BIN", sys.executable)
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, env=env)
    if result.returncode != expect:
        raise AssertionError(f"command failed with {result.returncode}: {' '.join(command)}\nstdout={result.stdout}\nstderr={result.stderr}")
    return result


def copy_source(destination: Path) -> None:
    def ignore(path: str, names: list[str]) -> set[str]:
        ignored = {".git", "node_modules", "artifacts", "__pycache__"}
        return {name for name in names if name in ignored}
    shutil.copytree(ROOT, destination, ignore=ignore, dirs_exist_ok=True)


def main() -> int:
    checks: list[str] = []
    failures: list[str] = []

    def check(name: str, fn) -> None:
        try:
            fn()
            checks.append(name)
        except Exception as exc:  # noqa: BLE001 - validator reports each failed control
            failures.append(f"{name}: {exc}")

    schema_files = [
        ("skill-metadata", ROOT / "config/skill-metadata-schema.json"),
        ("skill-scaffold", ROOT / "config/skill-scaffold-schema.json"),
        ("skill-sdk-policy", ROOT / "config/skill-sdk-policy-schema.json"),
        ("feedback-eval", ROOT / "config/feedback-eval-schema.json"),
        ("autonomy-experiment", ROOT / "config/autonomy-experiment-schema.json"),
        ("consolidation-policy", ROOT / "config/consolidation-policy-schema.json"),
    ]
    for name, schema_path in schema_files:
        check(f"schema:{name}", lambda schema_path=schema_path: Draft7Validator.check_schema(load(schema_path)))
    check("instance:skill-sdk-policy", lambda: validate(ROOT / "config/skill-sdk-policy.json", ROOT / "config/skill-sdk-policy-schema.json") == [])
    check("instance:consolidation-policy", lambda: validate(ROOT / "config/consolidation-policy.json", ROOT / "config/consolidation-policy-schema.json") == [])
    check("skill-sdk-policy:fail-closed", lambda: (
        load(ROOT / "config/skill-sdk-policy.json")["scaffold"]["auto_register"] is False
        and load(ROOT / "config/skill-sdk-policy.json")["scaffold"]["auto_promote"] is False
        and load(ROOT / "config/skill-sdk-policy.json")["autonomy_experiments"]["external_writes_allowed"] is False
        and load(ROOT / "config/skill-sdk-policy.json")["feedback_ingestion"]["requires_human_approval"] is True
    ) or (_ for _ in ()).throw(AssertionError("policy is not fail-closed")))

    for script in [
        "create-skill-scaffold.py",
        "apply-skill-scaffold.py",
        "ingest-feedback-to-eval.py",
        "run-autonomy-experiments.py",
        "analyze-skill-consolidation.py",
        "validate-batch9-controls.py",
    ]:
        check(f"python:{script}", lambda script=script: py_compile.compile(str(ROOT / "scripts" / script), doraise=True))
    check("cli:batch9-help", lambda: (run([str(ROOT / "aiw"), "help"]).returncode == 0))
    check("cli:skill-create-help", lambda: (run([str(ROOT / "aiw"), "skill", "create", "--help"]).returncode == 0))

    def scaffold_and_apply() -> None:
        with tempfile.TemporaryDirectory(prefix="aiw-batch9-validator-") as raw:
            temp = Path(raw)
            copy_source(temp)
            draft = temp / "artifacts/skill-scaffolds/validator-demo-skill"
            run([
                "python3", str(ROOT / "scripts/create-skill-scaffold.py"),
                "--name", "validator-demo-skill", "--domain", "system",
                "--description", "Batch 9 validator fixture skill.",
                "--team", "platform", "--maintainer", "batch9-validator",
                "--output-root", str(draft.parent),
            ])
            before_index = (temp / "skills/index.yaml").read_text()
            dry = run(["python3", str(ROOT / "scripts/apply-skill-scaffold.py"), "--root", str(temp), "--scaffold", str(draft)])
            assert '"verdict": "plan"' in dry.stdout
            assert (temp / "skills/index.yaml").read_text() == before_index
            applied = run([
                "python3", str(ROOT / "scripts/apply-skill-scaffold.py"), "--root", str(temp),
                "--scaffold", str(draft), "--apply", "--approved-by", "batch9-validator",
            ])
            assert '"registered": true' in applied.stdout
            registry = load(temp / "skills/registry.json")
            entry = next(item for item in registry["skills"] if item["name"] == "validator-demo-skill")
            assert entry["status"] == "draft"
            assert entry["skill_metadata"]["maturity"] == "experimental"
            graph = (temp / "skills/graph/skill-graph.yaml").read_text()
            assert "name: validator-demo-skill" in graph
            assert not (temp / ".opencode/skills/validator-demo-skill/skill-manifest.json").exists() is False
    check("skill-sdk:scaffold-apply-and-registration", scaffold_and_apply)

    def apply_rollback() -> None:
        with tempfile.TemporaryDirectory(prefix="aiw-batch9-rollback-") as raw:
            temp = Path(raw)
            copy_source(temp)
            draft = temp / "artifacts/skill-scaffolds/rollback-demo-skill"
            run([
                "python3", str(ROOT / "scripts/create-skill-scaffold.py"),
                "--name", "rollback-demo-skill", "--domain", "system",
                "--description", "Batch 9 rollback fixture skill.", "--output-root", str(draft.parent),
            ])
            skill_file = draft / "SKILL.md"
            skill_file.write_text(skill_file.read_text().replace("## Purpose", "## Objective"))
            before = (temp / "skills/index.yaml").read_text()
            result = run([
                "python3", str(ROOT / "scripts/apply-skill-scaffold.py"), "--root", str(temp),
                "--scaffold", str(draft), "--apply", "--approved-by", "batch9-validator",
            ], expect=1)
            assert "missing sections" in (result.stdout + result.stderr).lower()
            assert (temp / "skills/index.yaml").read_text() == before
            assert not (temp / ".opencode/skills/rollback-demo-skill").exists()
    check("skill-sdk:apply-rollback", apply_rollback)

    def feedback_controls() -> None:
        with tempfile.TemporaryDirectory(prefix="aiw-batch9-feedback-") as raw:
            temp = Path(raw)
            input_path = temp / "feedback.jsonl"
            input_path.write_text((ROOT / "evals/feedback/feedback-input.jsonl").read_text())
            pending = run([
                "python3", str(ROOT / "scripts/ingest-feedback-to-eval.py"), "--input", str(input_path),
                "--output", str(temp / "pending.json"), "--corpus-root", str(temp / "corpus"),
            ])
            assert '"pending": 2' in pending.stdout
            assert not (temp / "corpus").exists()
            approved = run([
                "python3", str(ROOT / "scripts/ingest-feedback-to-eval.py"), "--input", str(input_path),
                "--output", str(temp / "approved.json"), "--corpus-root", str(temp / "corpus"),
                "--approve", "FB-BATCH9-001", "--approved-by", "batch9-validator",
            ])
            assert '"approved": 1' in approved.stdout
            assert (temp / "corpus/cases/FB-BATCH9-001.json").is_file()
            duplicate = run([
                "python3", str(ROOT / "scripts/ingest-feedback-to-eval.py"), "--input", str(input_path),
                "--output", str(temp / "duplicate.json"), "--corpus-root", str(temp / "corpus"),
            ])
            assert '"duplicates": 1' in duplicate.stdout
            sensitive = temp / "sensitive.jsonl"
            sensitive.write_text('{"feedback_id":"FB-BATCH9-SECRET","skill_name":"security-review","source":"human-feedback","task_summary":"x","expected_properties":["y"],"sensitivity_class":"internal","token":"blocked"}\n')
            blocked = run([
                "python3", str(ROOT / "scripts/ingest-feedback-to-eval.py"), "--input", str(sensitive),
                "--output", str(temp / "sensitive-report.json"), "--corpus-root", str(temp / "corpus"),
            ], expect=1)
            assert '"invalid": 1' in blocked.stdout
    check("feedback:pending-approval-dedup-and-scrub", feedback_controls)

    def autonomy_controls() -> None:
        with tempfile.TemporaryDirectory(prefix="aiw-batch9-autonomy-") as raw:
            temp = Path(raw)
            result = run([
                "python3", str(ROOT / "scripts/run-autonomy-experiments.py"),
                "--output-root", str(temp / "autonomy"),
            ])
            summary = json.loads(result.stdout)
            assert summary["experiment_count"] == 4
            assert summary["completed"] == 4
            assert summary["external_writes"] == 0
            assert summary["promoted"] == 0
            approved = run([
                "python3", str(ROOT / "scripts/run-autonomy-experiments.py"),
                "--pattern", "routing", "--output-root", str(temp / "approved"),
                "--approve", "--approved-by", "batch9-validator",
            ])
            assert '"promoted": 1' in approved.stdout
    check("autonomy:bounded-zero-write-experiments", autonomy_controls)

    def consolidation_controls() -> None:
        with tempfile.TemporaryDirectory(prefix="aiw-batch9-consolidation-") as raw:
            temp = Path(raw)
            result = run([
                "python3", str(ROOT / "scripts/analyze-skill-consolidation.py"),
                "--output", str(temp / "report.json"),
            ])
            report = json.loads(result.stdout)
            assert report["overlap_count"] == 1
            assert report["registry_mutated"] is False
            assert report["applied_count"] == 0
    check("consolidation:recommendation-only", consolidation_controls)

    print(json.dumps({"checks": len(checks), "failures": failures, "verdict": "pass" if not failures else "block"}, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())

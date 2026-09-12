"""Validate Batch 8 operational controls and generated deterministic evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path):
    with path.open() as handle:
        return json.load(handle)


def validate(schema_path: Path, value, label: str) -> list[str]:
    schema = load(schema_path)
    Draft7Validator.check_schema(schema)
    return [f"{label}: {error.message}" for error in Draft7Validator(schema, format_checker=FormatChecker()).iter_errors(value)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--supply-chain-only", action="store_true")
    args = parser.parse_args()
    failures: list[str] = []
    checks = 0

    schema_paths = [
        ROOT / "config/operational-evidence-bundle-schema.json",
        ROOT / "config/telemetry-event-schema.json",
        ROOT / "config/slo-policy-schema.json",
        ROOT / "config/supply-chain-policy-schema.json",
        ROOT / "config/incident-containment-schema.json",
        ROOT / "config/model-compatibility-policy-schema.json",
    ]
    for path in schema_paths:
        try:
            Draft7Validator.check_schema(load(path))
            checks += 1
        except Exception as error:
            failures.append(f"{path.name}: invalid schema: {error}")

    supply_schema = ROOT / "config/supply-chain-policy-schema.json"
    supply_policy = load(ROOT / "config/supply-chain-policy.json")
    failures.extend(validate(supply_schema, supply_policy, "supply-chain policy"))
    if not failures:
        checks += 1
    if supply_policy["ci_action_policy"]["immutable_pins_required"] and supply_policy["ci_action_policy"]["latest_tags_forbidden"]:
        checks += 1
    else:
        failures.append("supply-chain policy does not require immutable pins and forbid moving tags")

    if args.supply_chain_only:
        sbom = ROOT / "artifacts/sbom.cdx.json"
        scan = ROOT / "artifacts/dependency-scan.json"
        if not sbom.exists() or not scan.exists():
            failures.append("supply-chain artifacts are missing")
        else:
            sbom_data = load(sbom)
            scan_data = load(scan)
            required = {"bomFormat", "specVersion", "serialNumber", "metadata", "components", "dependencies"}
            if not required <= set(sbom_data):
                failures.append("SBOM is missing required CycloneDX fields")
            else:
                checks += 1
            if scan_data.get("verdict") != "pass" or scan_data.get("findings"):
                failures.append("dependency scan is not a clean pass")
            else:
                checks += 1
    else:
        slo_policy = load(ROOT / "config/slo-policy.json")
        failures.extend(validate(ROOT / "config/slo-policy-schema.json", slo_policy, "SLO policy"))
        if not failures:
            checks += 1
        if slo_policy["error_budget_policy"] == "pause_deploys" and {rule["window"] for rule in slo_policy["burn_rate_rules"]} == {"1h", "6h", "1d", "3d"}:
            checks += 1
        else:
            failures.append("SLO policy is missing pause-deploys or four burn-rate windows")

        telemetry_policy = load(ROOT / "config/telemetry-policy.json")
        if telemetry_policy["opt_out"]["check_order"] == "first-and-unconditional" and telemetry_policy["retention"]["ring_buffer_max_events"] == 500 and telemetry_policy["external_writes_allowed"] is False:
            checks += 1
        else:
            failures.append("telemetry privacy policy invariants are incomplete")

        bundle_paths = sorted((ROOT / "artifacts/operational").glob("*/evidence-bundle.json"))
        if {path.parent.name for path in bundle_paths} != {"full-pipeline", "insights-adaptation-pipeline"}:
            failures.append("two required generalized operational evidence bundles are missing")
        else:
            for path in bundle_paths:
                failures.extend(validate(ROOT / "config/operational-evidence-bundle-schema.json", load(path), path.name))
            if not failures:
                checks += 1

        slo_report = ROOT / "artifacts/slo-report.json"
        if not slo_report.exists() or load(slo_report).get("verdict") != "pass":
            failures.append("measured SLO report is missing or blocked")
        else:
            checks += 1
        privacy_report = ROOT / "artifacts/telemetry/privacy-test.json"
        if not privacy_report.exists() or load(privacy_report).get("verdict") != "pass":
            failures.append("telemetry privacy test report is missing or blocked")
        else:
            checks += 1
        model_policy = load(ROOT / "config/model-compatibility-policy.json")
        failures.extend(validate(ROOT / "config/model-compatibility-policy-schema.json", model_policy, "model compatibility policy"))
        model_report = ROOT / "artifacts/model-compatibility-report.json"
        if not model_report.exists() or load(model_report).get("verdict") != "pass" or not load(model_report).get("rollback_verified"):
            failures.append("model compatibility report is missing, blocked, or rollback was not verified")
        else:
            checks += 1

        incident_summary = ROOT / "artifacts/incidents/summary.json"
        if not incident_summary.exists() or load(incident_summary).get("verdict") != "pass" or load(incident_summary).get("external_writes") != 0:
            failures.append("incident containment simulations are missing, blocked, or wrote externally")
        else:
            checks += 1

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        print(f"Batch 8 control validation failed — {checks} checks passed, {len(failures)} failed", file=sys.stderr)
        return 1
    print(f"Batch 8 control validation passed — {checks} checks passed, 0 failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

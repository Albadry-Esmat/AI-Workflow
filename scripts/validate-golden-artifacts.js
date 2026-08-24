#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const fixtureFile = path.resolve(process.env.AIW_GOLDEN_FILE || path.join(root, "tests", "fixtures", "golden-artifacts.json"));
const compatibilityFile = path.join(root, "compatibility.json");
const failures = [];
function fail(message) { failures.push(message); console.error(`FAIL ${message}`); }
function pass(message) { console.log(`PASS ${message}`); }
let fixture;
try { fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8")); pass("golden artifact fixture parses"); }
catch (error) { fail(`golden fixture cannot be read: ${error.message}`); }
let compatibility;
try { compatibility = JSON.parse(fs.readFileSync(compatibilityFile, "utf8")); }
catch (error) { fail(`compatibility manifest cannot be read: ${error.message}`); }
if (compatibility?.operational_contracts) {
  const expected = compatibility.operational_contracts;
  const actualFiles = {
    mcp_policy_version: path.join(root, "mcp-permission-policy.json"),
    budget_policy_version: path.join(root, "execution-budget.json"),
    quality_policy_version: path.join(root, "artifact-quality-policy.json"),
    pilot_evidence_version: path.join(root, "tests/fixtures/pilot-evidence.json"),
  };
  for (const [key, filePath] of Object.entries(actualFiles)) {
    try {
      const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const actual = key === "mcp_policy_version" ? value.policy_version : key === "budget_policy_version" ? value.schema_version : key === "quality_policy_version" ? value.policy_version : value.record_version;
      if (actual !== expected[key]) fail(`${key} ${actual || "missing"} differs from compatibility manifest ${expected[key]}`);
    } catch (error) { fail(`${key} source cannot be read: ${error.message}`); }
  }
}
if (fixture && compatibility) {
  if (fixture.fixture_version !== "1.0.0") fail(`unsupported fixture version: ${fixture.fixture_version || "missing"}`);
  if (fixture.compatibility?.framework_version !== compatibility.framework_version) fail("golden framework version differs from compatibility manifest");
  if (fixture.compatibility?.schema_version !== compatibility.schema_version) fail("golden schema version differs from compatibility manifest");
  if (!Array.isArray(fixture.artifacts) || fixture.artifacts.length < 6) fail("golden artifact catalog is incomplete");
  const seen = new Set();
  for (const artifact of fixture.artifacts || []) {
    if (!artifact.type || seen.has(artifact.type)) fail(`artifact type is missing or duplicated: ${artifact.type || "unknown"}`);
    seen.add(artifact.type);
    if (!Array.isArray(artifact.required_fields) || artifact.required_fields.length === 0) fail(`${artifact.type}: required_fields is empty`);
    if (artifact.content_policy !== "structured-only") fail(`${artifact.type}: content policy must remain structured-only`);
    if ((artifact.required_fields || []).some((field) => /prompt|token|secret|authorization|payload/i.test(field))) fail(`${artifact.type}: unsafe field appears in golden contract`);
  }
}
if (failures.length) { console.error(`Golden artifact validation failed (${failures.length} issue(s)).`); process.exit(1); }
console.log("Golden artifact compatibility validation passed.");

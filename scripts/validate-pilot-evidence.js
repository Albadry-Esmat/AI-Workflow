#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const file = path.resolve(process.env.AIW_PILOT_EVIDENCE || process.argv[2] || path.join(root, "tests/fixtures/pilot-evidence.json"));
const failures = [];
function fail(message) { failures.push(message); console.error(`FAIL ${message}`); }
function pass(message) { console.log(`PASS ${message}`); }
let evidence;
try { evidence = JSON.parse(fs.readFileSync(file, "utf8")); pass(`pilot evidence parses: ${path.relative(root, file)}`); }
catch (error) { fail(`pilot evidence cannot be read: ${error.message}`); }
if (evidence) {
  for (const field of ["record_version", "release_commit", "project_id", "correlation_id", "pipeline_runs", "backup", "recovery", "external_writes", "secret_exposure", "decision"]) {
    if (evidence[field] === undefined) fail(`required evidence field is missing: ${field}`);
  }
  if (evidence.record_version !== "1.0.0") fail(`unsupported evidence version: ${evidence.record_version}`);
  if (!Array.isArray(evidence.pipeline_runs) || evidence.pipeline_runs.length === 0) fail("at least one pipeline run is required");
  for (const run of evidence.pipeline_runs || []) {
    for (const field of ["name", "started_at", "finished_at", "status", "retry_count", "artifacts"]) if (run[field] === undefined) fail(`pipeline run missing field: ${field}`);
    if (!['pass', 'fail', 'blocked'].includes(run.status)) fail(`invalid pipeline run status: ${run.status}`);
    if (!Number.isInteger(run.retry_count) || run.retry_count < 0) fail("retry_count must be a non-negative integer");
    for (const artifact of run.artifacts || []) if (!artifact.name || artifact.schema_valid !== true) fail(`artifact is missing a valid schema result: ${artifact.name || "unknown"}`);
  }
  if (evidence.backup?.checksum_verified !== true) fail("backup checksum verification is required");
  if (!['pass', 'fail', 'not-run'].includes(evidence.recovery?.result)) fail("recovery result must be pass, fail, or not-run");
  if (!['none', 'approved', 'unknown'].includes(evidence.external_writes)) fail("external_writes must be none, approved, or unknown");
  if (evidence.secret_exposure !== "none") fail("secret_exposure must be none");
  if (!['pilot-ready', 'blocked', 'controlled-production-ready'].includes(evidence.decision)) fail(`invalid evidence decision: ${evidence.decision}`);
  const serialized = JSON.stringify(evidence);
  const prohibitedKeys = Object.keys(evidence).filter((key) => /prompt|payload|token|authorization|password|personal.?data|session.?json/i.test(key));
  if (prohibitedKeys.length) fail(`evidence contains prohibited sensitive-data field(s): ${prohibitedKeys.join(", ")}`);
  if (/Bearer\s+(?!\[REDACTED\])|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]|sk-[A-Za-z0-9]/i.test(serialized)) fail("evidence contains a credential-like value");
}
if (failures.length) { console.error(`Pilot evidence validation failed (${failures.length} issue(s)).`); process.exit(1); }
console.log("Pilot evidence validation passed.");

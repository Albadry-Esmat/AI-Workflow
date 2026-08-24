#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const file = path.resolve(process.env.AIW_RUNTIME_CERTIFICATION || process.argv[2] || path.join(root, "tests/fixtures/runtime-certification.json"));
const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => { failures.push(message); console.error(`FAIL ${message}`); };

function loadJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function check(condition, message) {
  if (!condition) fail(message);
}

function collectKeys(value, prefix = "", output = []) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    output.push(fullKey);
    collectKeys(child, fullKey, output);
  }
  return output;
}

let evidence;
try {
  evidence = JSON.parse(fs.readFileSync(file, "utf8"));
  pass(`runtime certification evidence parses: ${path.relative(root, file)}`);
} catch (error) {
  fail(`runtime certification evidence cannot be read: ${error.message}`);
}

if (evidence) {
  const registry = loadJson(".ai-workflow/adapter-registry.json");
  const matrix = loadJson(".ai-workflow/runtime-capability-matrix.json");
  const adapter = registry.adapters?.[evidence.adapter_id];
  const matrixRuntime = matrix.runtimes?.[evidence.runtime_id];

  check(evidence.record_version === "1.0.0", "record_version must be 1.0.0");
  check(typeof evidence.runtime_id === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(evidence.runtime_id), "runtime_id is invalid");
  check(typeof evidence.adapter_id === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(evidence.adapter_id), "adapter_id is invalid");
  check(Boolean(adapter), `adapter is not registered: ${evidence.adapter_id}`);
  check(Boolean(matrixRuntime), `runtime is not present in capability matrix: ${evidence.runtime_id}`);
  if (adapter && matrixRuntime) {
    check(evidence.runtime_id === evidence.adapter_id, "runtime_id and adapter_id must identify the same certified target");
    check(adapter.status !== "supported" || evidence.evidence_state === "pilot-certified", "supported adapter claims require pilot-certified evidence");
  }

  check(typeof evidence.release_commit === "string" && /^[A-Za-z0-9._/-]{7,128}$/.test(evidence.release_commit), "release_commit is invalid");
  check(isIsoDate(evidence.tested_at), "tested_at must be an ISO-8601 date-time");
  check(evidence.environment && typeof evidence.environment === "object", "environment is required");
  const environment = evidence.environment || {};
  check(["repository-fixture", "terminal", "host-editor", "wrapper"].includes(environment.execution_surface), "environment.execution_surface is invalid");
  check(typeof environment.runtime_version === "string" && environment.runtime_version.length > 0 && environment.runtime_version.length <= 128, "environment.runtime_version is required");
  check(typeof environment.adapter_version === "string" && environment.adapter_version.length > 0 && environment.adapter_version.length <= 128, "environment.adapter_version is required");
  check(["repository-fixture", "disposable", "non-sensitive"].includes(environment.project_classification), "environment.project_classification is invalid");
  check(["repository-fixtures-only", "operator-verified", "pilot-certified", "blocked"].includes(evidence.evidence_state), "evidence_state is invalid");
  check(["pilot-ready", "certified-capabilities-only", "blocked", "no-go"].includes(evidence.decision), "decision is invalid");
  check(typeof evidence.operator === "string" && evidence.operator.length > 0, "operator is required");
  check(typeof evidence.independent_reviewer === "string" && evidence.independent_reviewer.length > 0, "independent_reviewer is required");
  check(evidence.secret_exposure === "none", "secret_exposure must be none");

  const requiredChecks = ["version-preflight", "mcp-profile", "read-only-smoke", "approval-stop", "approved-canary", "recovery", "artifact-review", "independent-review"];
  const checks = Array.isArray(evidence.checks) ? evidence.checks : [];
  check(checks.length > 0, "at least one certification check is required");
  const checkIds = new Set();
  for (const item of checks) {
    check(item && requiredChecks.includes(item.id), `invalid or missing check id: ${item?.id || "unknown"}`);
    check(!checkIds.has(item.id), `duplicate certification check: ${item.id}`);
    checkIds.add(item.id);
    check(["pass", "fail", "blocked", "not-run"].includes(item.result), `invalid result for check ${item.id}`);
    check(typeof item.detail === "string" && item.detail.length > 0 && item.detail.length <= 500, `invalid detail for check ${item.id}`);
  }

  const capabilities = Array.isArray(evidence.capability_decisions) ? evidence.capability_decisions : [];
  check(capabilities.length > 0, "at least one capability decision is required");
  const capabilityIds = new Set();
  for (const item of capabilities) {
    check(item && typeof item.capability === "string" && item.capability.length > 0, "capability decision is missing a capability");
    check(!capabilityIds.has(item.capability), `duplicate capability decision: ${item.capability}`);
    capabilityIds.add(item.capability);
    check(["verified", "degraded", "blocked", "not-run"].includes(item.decision), `invalid capability decision: ${item.decision}`);
    if (item.evidence_ref !== undefined) check(typeof item.evidence_ref === "string" && item.evidence_ref.length <= 200, `invalid evidence_ref for ${item.capability}`);
  }

  const passIds = new Set(checks.filter((item) => item.result === "pass").map((item) => item.id));
  if (evidence.evidence_state === "repository-fixtures-only") {
    check(environment.execution_surface === "repository-fixture", "repository-fixtures-only evidence must use repository-fixture surface");
    check(evidence.decision !== "certified-capabilities-only", "fixture-only evidence cannot certify capabilities");
  }
  if (evidence.evidence_state === "operator-verified") {
    check(environment.execution_surface !== "repository-fixture", "operator-verified evidence cannot use repository-fixture surface");
    check(passIds.has("version-preflight"), "operator-verified evidence requires version-preflight pass");
  }
  if (evidence.evidence_state === "pilot-certified") {
    check(environment.execution_surface !== "repository-fixture", "pilot-certified evidence cannot use repository-fixture surface");
    check(environment.project_classification !== "repository-fixture", "pilot-certified evidence cannot use repository-fixture classification");
    for (const id of requiredChecks) check(passIds.has(id), `pilot-certified evidence requires ${id} pass`);
    check(evidence.decision === "certified-capabilities-only", "pilot-certified evidence must use certified-capabilities-only decision");
  }
  if (["blocked", "no-go"].includes(evidence.decision)) {
    check(evidence.evidence_state === "blocked" || checks.some((item) => ["fail", "blocked", "not-run"].includes(item.result)), "blocked/no-go decision requires blocked evidence or an incomplete/failed check");
  }

  const serialized = JSON.stringify(evidence);
  const prohibitedKeys = collectKeys(evidence).filter((key) => key !== "secret_exposure" && /prompt|payload|token|authorization|password|personal.?data|session.?json|secret/i.test(key));
  check(prohibitedKeys.length === 0, `evidence contains prohibited sensitive-data field(s): ${prohibitedKeys.join(", ")}`);
  check(!/Bearer\s+(?!\[REDACTED\])|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]|sk-[A-Za-z0-9]/i.test(serialized), "evidence contains a credential-like value");
  pass("runtime certification evidence is sanitized and promotion state is consistent");
}

if (failures.length) {
  console.error(`Runtime certification validation failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("Runtime certification validation passed.");

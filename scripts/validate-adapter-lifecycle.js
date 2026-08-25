#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const file = path.resolve(process.env.AIW_ADAPTER_LIFECYCLE || process.argv[2] || path.join(root, ".ai-workflow/adapter-lifecycle.json"));
const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => { failures.push(message); console.error(`FAIL ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };

function loadJson(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
function isIsoDate(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function collectKeys(value, prefix = "", output = []) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    output.push(full);
    collectKeys(child, full, output);
  }
  return output;
}

let lifecycle;
try {
  lifecycle = JSON.parse(fs.readFileSync(file, "utf8"));
  pass(`adapter lifecycle manifest parses: ${path.relative(root, file)}`);
} catch (error) {
  fail(`adapter lifecycle manifest cannot be read: ${error.message}`);
}

if (lifecycle) {
  let registry = {};
  let matrix = {};
  try { registry = loadJson(".ai-workflow/adapter-registry.json"); matrix = loadJson(".ai-workflow/runtime-capability-matrix.json"); }
  catch (error) { fail(`canonical compatibility metadata cannot be read: ${error.message}`); }

  check(lifecycle.lifecycle_version === "1.0.0", "lifecycle_version must be 1.0.0");
  const registered = new Set(Object.keys(registry.adapters || {}));
  const entries = lifecycle.adapters && typeof lifecycle.adapters === "object" ? lifecycle.adapters : {};
  const lifecycleIds = new Set(Object.keys(entries));
  for (const id of registered) check(lifecycleIds.has(id), `lifecycle entry missing for registered adapter: ${id}`);
  for (const id of lifecycleIds) check(registered.has(id), `lifecycle entry is not registered: ${id}`);

  for (const [id, entry] of Object.entries(entries)) {
    const adapter = registry.adapters?.[id];
    const matrixRuntime = matrix.runtimes?.[id];
    let descriptor;
    try {
      descriptor = adapter ? require(path.join(root, adapter.entrypoint, "index.js")).descriptor : null;
    } catch (error) {
      fail(`adapter descriptor cannot be loaded for lifecycle entry ${id}: ${error.message}`);
    }
    check(adapter && matrixRuntime && descriptor, `canonical metadata missing for lifecycle entry: ${id}`);
    check(["active", "blocked", "deprecated"].includes(entry.state), `invalid lifecycle state: ${id}`);
    check(["reference", "experimental", "degraded", "blocked", "deprecated"].includes(entry.support_claim), `invalid support claim: ${id}`);
    check(typeof entry.review_owner === "string" && entry.review_owner.length > 0 && !/pending|unassigned|unknown/i.test(entry.review_owner), `review_owner must be assigned: ${id}`);
    check(isIsoDate(entry.last_reviewed_at), `last_reviewed_at must be ISO-8601: ${id}`);

    if (adapter) {
      if (adapter.status === "reference") check(entry.support_claim === "reference", `reference adapter must retain reference claim: ${id}`);
      if (adapter.status === "experimental") check(["experimental", "degraded", "blocked", "deprecated"].includes(entry.support_claim), `experimental adapter has invalid support claim: ${id}`);
      if (adapter.status === "supported") check(entry.support_claim === "reference" || entry.support_claim === "experimental", `unsupported lifecycle claim for supported adapter: ${id}`);
    }
    if (descriptor) {
      check(descriptor.adapter_id === id, `descriptor adapter_id does not match lifecycle entry: ${id}`);
      check(descriptor.status === adapter.status, `descriptor status does not match registry: ${id}`);
      check(descriptor.tier === adapter.tier, `descriptor tier does not match registry: ${id}`);
    }
    if (matrixRuntime) {
      check(matrixRuntime.status === adapter.status, `matrix status does not match registry: ${id}`);
      check(matrixRuntime.tier === adapter.tier, `matrix tier does not match registry: ${id}`);
      check(matrixRuntime.evidence === adapter.real_evidence, `matrix evidence does not match registry: ${id}`);
      if (entry.state !== "active") check(matrixRuntime.status !== "supported", `blocked/deprecated adapter cannot be matrix-supported: ${id}`);
    }

    if (entry.state === "active") {
      check(!["blocked", "deprecated"].includes(entry.support_claim), `active adapter cannot claim blocked/deprecated: ${id}`);
      check(typeof entry.migration === "string" && entry.migration.length > 0, `active adapter requires a migration/usage limitation: ${id}`);
    }
    if (entry.state === "blocked") {
      check(entry.support_claim === "blocked", `blocked adapter must use blocked support claim: ${id}`);
      check(typeof entry.block_reason === "string" && entry.block_reason.length > 0, `blocked adapter requires block_reason: ${id}`);
      check(typeof entry.unblock_criteria === "string" && entry.unblock_criteria.length > 0, `blocked adapter requires unblock_criteria: ${id}`);
    }
    if (entry.state === "deprecated") {
      check(entry.support_claim === "deprecated", `deprecated adapter must use deprecated support claim: ${id}`);
      check(typeof entry.deprecation_reason === "string" && entry.deprecation_reason.length > 0, `deprecated adapter requires deprecation_reason: ${id}`);
      check(isIsoDate(entry.effective_at), `deprecated adapter requires effective_at: ${id}`);
      check(typeof entry.migration === "string" && entry.migration.length > 0, `deprecated adapter requires migration: ${id}`);
      if (entry.successor !== null && entry.successor !== undefined) check(registered.has(entry.successor), `deprecated adapter successor is not registered: ${id}`);
      else check(/no successor|remain|manual|migration|unsupported/i.test(entry.migration), `deprecated adapter without successor requires an explicit migration limitation: ${id}`);
      check(entry.successor !== id, `deprecated adapter cannot name itself as successor: ${id}`);
    }
  }

  const serialized = JSON.stringify(lifecycle);
  const prohibitedKeys = collectKeys(lifecycle).filter((key) => /prompt|payload|token|authorization|password|personal.?data|session.?json|secret/i.test(key));
  check(prohibitedKeys.length === 0, `lifecycle manifest contains prohibited sensitive-data field(s): ${prohibitedKeys.join(", ")}`);
  check(!/Bearer\s+(?!\[REDACTED\])|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]|sk-[A-Za-z0-9]/i.test(serialized), "lifecycle manifest contains a credential-like value");
  pass(`adapter lifecycle entries validated: ${Object.keys(entries).length}`);
}

if (failures.length) {
  console.error(`Adapter lifecycle validation failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("Adapter lifecycle validation passed.");

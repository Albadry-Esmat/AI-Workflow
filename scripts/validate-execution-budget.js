#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const file = path.resolve(process.env.AIW_BUDGET_FILE || path.join(root, "execution-budget.json"));
const failures = [];
function fail(message) { failures.push(message); console.error(`FAIL ${message}`); }
function pass(message) { console.log(`PASS ${message}`); }
let policy;
try { policy = JSON.parse(fs.readFileSync(file, "utf8")); pass(`budget policy parses: ${path.relative(root, file)}`); }
catch (error) { fail(`budget policy cannot be read: ${error.message}`); }

const required = ["max_active_sessions", "max_queue_depth", "max_retries_per_task", "max_total_retries", "max_duration_ms", "max_estimated_tokens", "max_external_api_calls"];
if (policy) {
  if (policy.schema_version !== "1.0.0") fail(`unsupported budget schema version: ${policy.schema_version || "missing"}`);
  if (!policy.limits || typeof policy.limits !== "object") fail("limits object is missing");
  for (const key of required) {
    const value = policy.limits?.[key];
    if (!Number.isInteger(value) || value < 1) fail(`${key} must be a positive integer`);
  }
  if (policy.limits?.max_retries_per_task > policy.limits?.max_total_retries) fail("per-task retry limit cannot exceed total retry limit");
  if (!['pause-for-approval', 'stop-safely'].includes(policy.actions?.on_threshold)) fail("on_threshold must pause-for-approval or stop-safely");
  if (policy.actions?.on_hard_limit !== "stop-safely") fail("on_hard_limit must be stop-safely");
}
if (failures.length) {
  console.error(`Execution budget validation failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("Execution budget validation passed.");

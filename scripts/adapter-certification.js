#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { validateDescriptor, createRequest, normalizeEvent, validateRequestPolicy } = require("./lib/adapter-contract");
const { loadMcpPolicy } = require("./lib/runtime-guards");

const root = path.resolve(__dirname, "..");
const adapterId = process.argv[2] || "opencode";
const adapterPath = path.resolve(root, process.argv[3] || `adapters/${adapterId}/index.js`);
const failures = [];
const checks = [];
function check(label, callback) { try { callback(); checks.push(`PASS ${label}`); } catch (error) { failures.push(`${label}: ${error.message}`); } }
let adapter;
try { adapter = require(adapterPath); } catch (error) { console.error(`ADAPTER_LOAD_FAILED: ${error.message}`); process.exit(1); }
check("descriptor is valid", () => validateDescriptor(adapter.descriptor));
check("discovery matches descriptor", () => {
  const discovered = adapter.discover();
  if (discovered.adapter_id !== adapter.descriptor.adapter_id) throw new Error("discovery adapter ID mismatch");
});
check("read-only request is policy-valid", () => {
  const request = createRequest({ pipeline_id: "certification", task_id: "read-only", required_capabilities: ["read:repository"] });
  validateRequestPolicy(request, { policy: loadMcpPolicy(), approval: false });
});
check("write request is denied without approval", () => {
  const request = createRequest({ pipeline_id: "certification", task_id: "write", mcp_profile: "repository-write", required_capabilities: ["write:repository"] });
  let denied = false;
  try { validateRequestPolicy(request, { policy: loadMcpPolicy(), approval: false }); } catch (error) { denied = error.code === "MCP_APPROVAL_REQUIRED"; }
  if (!denied) throw new Error("write request was not denied");
});
check("event normalization is sanitized", () => {
  const event = normalizeEvent({ event: "failure", status: "failed", message: "Bearer ghp_secret-value" });
  if (event.message.includes("secret-value")) throw new Error("credential-like event content was not redacted");
  if (event.schema_version !== "1.0.0") throw new Error("event schema version missing");
});
check("dry-run step does not execute", () => {
  const session = adapter.startSession({ pipeline_id: "certification", task_id: "dry-run", required_capabilities: ["read:repository"], dry_run: true, mode: "dry-run" });
  const result = adapter.sendStep(session, { task_id: "dry-run", dryRun: true });
  if (result.executed !== false) throw new Error("dry-run executed");
});
check("host lifecycle limitation is explicit", () => {
  if (adapter.descriptor.runtime_family !== "editor-agent" && adapter.descriptor.runtime_family !== "editor-cloud-agent") return;
  const session = adapter.startSession({ pipeline_id: "certification", task_id: "host-live", required_capabilities: ["read:repository"], dry_run: true, mode: "read-only" });
  let blocked = false;
  try { adapter.sendStep(session, { task_id: "host-live", dryRun: false }); } catch (error) { blocked = error.code === "HOST_LIFECYCLE_UNAVAILABLE"; }
  if (!blocked) throw new Error("host adapter did not block unsupported live lifecycle");
});
if (failures.length) { console.error(`Adapter certification failed (${failures.length} issue(s)).`); failures.forEach((failure) => console.error(`  FAIL ${failure}`)); process.exit(1); }
console.log(`Adapter certification passed (${adapterId}; ${checks.length} checks).`);
checks.forEach((item) => console.log(`  ${item}`));

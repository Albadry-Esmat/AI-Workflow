#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const failures = [];
const pass = [];
function read(relative) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
  catch (error) { failures.push(`${relative}: ${error.message}`); return null; }
}
const registry = read(".ai-workflow/adapter-registry.json");
const matrix = read(".ai-workflow/runtime-capability-matrix.json");
const compatibility = read("compatibility.json");
if (compatibility?.operational_contracts) {
  if (compatibility.operational_contracts.adapter_registry_version !== registry?.registry_version) failures.push("adapter registry version differs from compatibility manifest");
  if (compatibility.operational_contracts.capability_matrix_version !== matrix?.matrix_version) failures.push("capability matrix version differs from compatibility manifest");
}
const schemaFiles = ["runtime-adapter.schema.json", "runtime-request.schema.json", "runtime-event.schema.json", "approval-request.schema.json", "checkpoint.schema.json", "artifact-envelope.schema.json"];
for (const file of schemaFiles) {
  if (fs.existsSync(path.join(root, ".ai-workflow/schemas", file))) pass.push(`schema present: ${file}`);
  else failures.push(`schema missing: .ai-workflow/schemas/${file}`);
}
if (registry && matrix) {
  if (registry.registry_version !== "1.0.0") failures.push(`unsupported registry version: ${registry.registry_version}`);
  if (matrix.matrix_version !== "1.0.0") failures.push(`unsupported capability matrix version: ${matrix.matrix_version}`);
  const registryIds = new Set(Object.keys(registry.adapters || {}));
  const matrixIds = new Set(Object.keys(matrix.runtimes || {}));
  for (const id of registryIds) if (!matrixIds.has(id)) failures.push(`registry runtime missing from matrix: ${id}`);
  for (const id of matrixIds) if (!registryIds.has(id)) failures.push(`matrix runtime missing from registry: ${id}`);
  for (const [id, adapter] of Object.entries(registry.adapters || {})) {
    if (adapter.tier === 1 && adapter.status === "certified" && adapter.real_evidence !== "controlled-pilot-pass") failures.push(`Tier 1 certified adapter lacks controlled pilot evidence: ${id}`);
    if (!Array.isArray(adapter.supported_operations)) failures.push(`adapter operations are not an array: ${id}`);
    if (!Array.isArray(adapter.supported_capabilities)) failures.push(`adapter capabilities are not an array: ${id}`);
    const modulePath = path.join(root, adapter.entrypoint, "index.js");
    if (!fs.existsSync(modulePath)) failures.push(`adapter entrypoint missing: ${id} -> ${adapter.entrypoint}`);
    else {
      try {
        const implementation = require(modulePath);
        const descriptor = implementation.descriptor;
        if (!descriptor || descriptor.adapter_id !== id) failures.push(`adapter descriptor ID mismatch: ${id}`);
        if (descriptor && descriptor.tier !== adapter.tier) failures.push(`adapter tier mismatch: ${id}`);
        if (descriptor && descriptor.status !== adapter.status) failures.push(`adapter status mismatch: ${id}`);
        if (descriptor && descriptor.supported_operations.length !== adapter.supported_operations.length) failures.push(`adapter operation surface mismatch: ${id}`);
      } catch (error) { failures.push(`adapter module cannot load: ${id}: ${error.message}`); }
    }
    if (adapter.status === "reference" && (adapter.supported_operations || []).length < 11) failures.push(`reference adapter is missing required operations: ${id}`);
    else pass.push(`adapter entry reviewed: ${id}`);
  }
}
if (failures.length) { console.error(`Adapter configuration validation failed (${failures.length} issue(s)).`); failures.forEach((item) => console.error(`  FAIL: ${item}`)); process.exit(1); }
console.log(`Adapter configuration validation passed (${pass.length} checks).`);
pass.forEach((item) => console.log(`  PASS: ${item}`));

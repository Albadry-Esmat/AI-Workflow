#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, ".ai-workflow/adapter-registry.json"), "utf8"));
const results = [];
for (const adapterId of Object.keys(registry.adapters || {}).sort()) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/adapter-certification.js"), adapterId], { cwd: root, encoding: "utf8" });
  results.push({ adapter_id: adapterId, status: result.status === 0 ? "fixture-certified" : "failed", exit_code: result.status, output: result.status === 0 ? "credential-free contract checks passed" : "contract checks failed" });
}
const failed = results.filter((item) => item.status !== "fixture-certified");
console.log(JSON.stringify({ certification_version: "1.0.0", evidence_scope: "repository-fixtures-only", results }, null, 2));
if (failed.length) { console.error(`Adapter certification failed for ${failed.length} runtime(s).`); process.exit(1); }
console.log(`All ${results.length} registered adapters passed fixture certification. No live runtime evidence was produced.`);

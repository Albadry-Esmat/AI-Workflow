#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
function value(flag, fallback) { const i = process.argv.indexOf(flag); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; }
const type = value("--type");
const input = value("--input");
const output = value("--output");
if (!type || !input) {
  console.error("Usage: node scripts/score-artifact.js --type TYPE --input ARTIFACT.json [--output REPORT.json]");
  process.exit(2);
}
let policy;
let artifact;
try { policy = JSON.parse(fs.readFileSync(path.join(root, "artifact-quality-policy.json"), "utf8")); }
catch (error) { console.error(`QUALITY_POLICY_INVALID: ${error.message}`); process.exit(1); }
try { artifact = JSON.parse(fs.readFileSync(path.resolve(input), "utf8")); }
catch (error) { console.error(`ARTIFACT_INVALID_JSON: ${error.message}`); process.exit(1); }
const contract = policy.artifact_types?.[type];
if (!contract) { console.error(`ARTIFACT_TYPE_UNKNOWN: ${type}`); process.exit(1); }
const prohibited = new RegExp((policy.prohibited_key_patterns || []).join("|"), "i");
const prohibitedKeys = Object.keys(artifact || {}).filter((key) => prohibited.test(key));
const missing = (contract.required_fields || []).filter((field) => !(field in (artifact || {})));
let score = 100 - missing.length * 20 - prohibitedKeys.length * 100;
if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) score = 0;
score = Math.max(0, Math.min(100, score));
const decision = prohibitedKeys.length || score < policy.human_review_score ? "reject" : score < policy.pass_score ? "needs_human_review" : "pass";
const report = { report_version: "1.0.0", artifact_type: type, score, decision, missing_fields: missing, prohibited_fields: prohibitedKeys, raw_payload_included: false, reviewed_fields: contract.required_fields };
if (output) {
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
console.log(JSON.stringify(report, null, 2));
if (decision === "reject") process.exit(1);

#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertMcpCapabilities } = require("./lib/runtime-guards");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
function value(flag, fallback) { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; }
const operation = value("--operation");
const target = value("--target");
const capability = value("--capability", "write:repository");
const profile = value("--profile", "repository-write");
const output = path.resolve(value("--output", path.join(root, ".opencode", "pilot-runs", `write-plan-${crypto.randomUUID()}.json`)));
const canary = args.includes("--canary");
const approved = args.includes("--approved");
if (!operation || !target) {
  console.error("Usage: node scripts/write-plan.js --operation NAME --target APPROVED-TARGET [--capability CAPABILITY] [--profile PROFILE] [--canary] [--approved] [--output FILE]");
  process.exit(2);
}
if (!canary) {
  console.error("WRITE_PLAN_REQUIRES_CANARY: use --canary to limit the planned operation to one approved target");
  process.exit(2);
}
let guard;
try { guard = assertMcpCapabilities({ required_capabilities: [capability] }, { profileName: profile, approval: approved }); }
catch (error) { console.error(error.message); process.exit(1); }
const plan = {
  plan_version: "1.0.0",
  created_at: new Date().toISOString(),
  operation: operation.slice(0, 120),
  target: target.slice(0, 240),
  profile: guard.profile,
  capability,
  canary: true,
  approval_recorded: approved,
  dry_run: true,
  executed: false,
  external_write_performed: false,
  next_step: "Review this manifest and use the operation-specific approved command only after explicit human approval.",
};
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Sanitized write plan created: ${path.relative(root, output)}`);
console.log(JSON.stringify({ operation, target, profile, capability, canary: true, executed: false }, null, 2));

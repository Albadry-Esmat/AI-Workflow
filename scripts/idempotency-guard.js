#!/usr/bin/env node

const { operationKey, inspect, claim, record } = require("./lib/idempotency");
const args = process.argv.slice(2);
function value(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; }
const operation = value("--operation");
const material = value("--material");
const file = value("--file");
const action = args.includes("--claim") ? "claim" : args.includes("--complete") ? "complete" : "inspect";
if (!operation || !material || (action === "complete" && !value("--status"))) {
  console.error("Usage: node scripts/idempotency-guard.js --operation NAME --material DIGEST [--file PATH] [--claim|--complete --status STATUS --result-category CATEGORY]");
  process.exit(2);
}
const key = operationKey(operation, material);
if (action === "inspect") {
  console.log(JSON.stringify({ key, operation, record: inspect(key, file) }, null, 2));
  process.exit(0);
}
if (action === "claim") {
  const result = claim(key, file);
  console.log(JSON.stringify({ key, operation, ...result }, null, 2));
  if (result.duplicate) process.exit(3);
} else {
  record(key, { status: value("--status"), result_category: value("--result-category") || "unspecified" }, file);
  console.log(JSON.stringify({ key, operation, status: value("--status") }, null, 2));
}

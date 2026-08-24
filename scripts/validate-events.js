#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { readEvents, summarizeEvents } = require("./lib/event-log");

const root = path.resolve(__dirname, "..");
const schemaFile = path.join(root, "skills/schema/execution-event.schema.json");
const eventFile = path.resolve(process.env.AIW_EVENTS_FILE || path.join(root, ".opencode/state/events.jsonl"));
const failures = [];
function fail(message) { failures.push(message); console.error(`FAIL ${message}`); }
function pass(message) { console.log(`PASS ${message}`); }
let schema;
try { schema = JSON.parse(fs.readFileSync(schemaFile, "utf8")); pass("execution event schema parses"); }
catch (error) { fail(`schema cannot be read: ${error.message}`); }

const allowedEvents = new Set(schema?.properties?.event?.enum || []);
const events = fs.existsSync(eventFile) ? readEvents(eventFile, 100000) : [];
for (const event of events) {
  for (const field of schema?.required || []) if (event[field] === undefined) fail(`event missing required field: ${field}`);
  if (!allowedEvents.has(event.event)) fail(`event type is not allowed: ${event.event}`);
  if (event.schema_version !== "1.0.0") fail(`unsupported event schema version: ${event.schema_version}`);
  for (const field of ["session_id", "pipeline_id", "skill", "status", "error_code", "message"]) {
    if (typeof event[field] === "string" && event[field].length > 500) fail(`event field too long: ${field}`);
  }
  if (typeof event.duration_ms === "number" && (!Number.isInteger(event.duration_ms) || event.duration_ms < 0)) fail("duration_ms must be a non-negative integer");
  if (typeof event.retry_count === "number" && (!Number.isInteger(event.retry_count) || event.retry_count < 0)) fail("retry_count must be a non-negative integer");
  if (/Bearer\s+(?!\[REDACTED\])|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]|sk-[A-Za-z0-9]/i.test(JSON.stringify(event))) fail("event contains a credential-like value");
}
if (failures.length) { console.error(`Event validation failed (${failures.length} issue(s)).`); process.exit(1); }
console.log(`Execution event validation passed (${events.length} event(s)).`);
console.log(JSON.stringify({ summary: summarizeEvents(events), retention_days: 7, raw_payloads_included: false }, null, 2));

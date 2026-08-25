#!/usr/bin/env node

const { readEvents, summarizeEvents, pruneEvents } = require("./lib/event-log");

const args = process.argv.slice(2);
const json = args.includes("--json");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 25;
const pruneIndex = args.indexOf("--prune-days");
if (pruneIndex >= 0) {
  const days = Number(args[pruneIndex + 1]);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    console.error("--prune-days must be an integer from 1 to 3650");
    process.exit(2);
  }
  console.log(JSON.stringify({ retention_days: days, ...pruneEvents(undefined, days) }));
}
if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
  console.error("Usage: node scripts/events.js [--json] [--limit N] [--prune-days N]");
  process.exit(2);
}

const events = readEvents(undefined, limit);
if (json) {
  console.log(JSON.stringify({ summary: summarizeEvents(events), events }, null, 2));
} else {
  const summary = summarizeEvents(events);
  console.log(`Events: ${summary.total}`);
  for (const [status, count] of Object.entries(summary.by_status)) console.log(`  ${status}: ${count}`);
  for (const event of events) {
    console.log(`${event.timestamp || "unknown-time"} ${event.event || "unknown"} ${event.status || ""} ${event.session_id || ""}`.trim());
  }
}

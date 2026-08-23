const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { withLock } = require("./state-store");

const DEFAULT_EVENTS_FILE = path.resolve(__dirname, "../../.opencode/state/events.jsonl");

function redact(value) {
  return String(value)
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/(ghp_|github_pat_|sk-)[A-Za-z0-9_-]+/g, "$1[REDACTED]")
    .replace(/([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY))\s*=\s*[^\s,;]+/g, "$1=[REDACTED]");
}

function eventsFile(file = process.env.AIW_EVENTS_FILE || DEFAULT_EVENTS_FILE) {
  return path.resolve(file);
}

function normalizeEvent(event = {}) {
  const allowed = ["event", "session_id", "pipeline_id", "phase_id", "skill", "status", "duration_ms", "retry_count", "error_code", "message", "schema_version"];
  const result = { timestamp: new Date().toISOString(), event_id: `evt-${crypto.randomUUID()}`, schema_version: "1.0.0" };
  for (const key of allowed) {
    if (event[key] !== undefined) {
      const value = event[key];
      result[key] = typeof value === "string" ? redact(value).slice(0, 500) : value;
    }
  }
  if (!result.event) result.event = "unknown";
  return result;
}

function appendEvent(event, file = eventsFile()) {
  const target = eventsFile(file);
  const lock = `${target}.lock`;
  const record = `${JSON.stringify(normalizeEvent(event))}\n`;
  withLock(lock, () => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, record, { encoding: "utf8", mode: 0o600 });
    try { fs.chmodSync(target, 0o600); } catch (_) {}
  });
  return record.trim();
}

function readEvents(file = eventsFile(), limit = 100) {
  const target = eventsFile(file);
  if (!fs.existsSync(target)) return [];
  return fs.readFileSync(target, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-Math.max(1, limit))
    .map((line) => {
      try { return JSON.parse(line); }
      catch (_) { return { event: "invalid_record", message: "event record could not be parsed" }; }
    });
}

function pruneEvents(file = eventsFile(), retentionDays = 7) {
  const target = eventsFile(file);
  if (!fs.existsSync(target)) return { removed: 0, retained: 0 };
  const cutoff = Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
  let removed = 0;
  let retained = 0;
  withLock(`${target}.lock`, () => {
    const lines = fs.readFileSync(target, "utf8").split(/\r?\n/).filter(Boolean);
    const keep = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.timestamp && Date.parse(event.timestamp) < cutoff) { removed += 1; continue; }
      } catch (_) {}
      keep.push(line);
    }
    retained = keep.length;
    const temporary = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`;
    fs.writeFileSync(temporary, keep.length ? `${keep.join("\n")}\n` : "", { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, target);
  });
  return { removed, retained };
}

function summarizeEvents(events) {
  const summary = { total: events.length, by_status: {}, by_event: {}, last: events.at(-1) || null };
  for (const event of events) {
    if (event.status) summary.by_status[event.status] = (summary.by_status[event.status] || 0) + 1;
    if (event.event) summary.by_event[event.event] = (summary.by_event[event.event] || 0) + 1;
  }
  return summary;
}

module.exports = { appendEvent, readEvents, summarizeEvents, pruneEvents, normalizeEvent, eventsFile };

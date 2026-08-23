#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { atomicWriteJson, readJsonWithRecovery } = require("./lib/state-store");
const { appendEvent } = require("./lib/event-log");

class ContractError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

function correlationId() {
  return `aiw-${crypto.randomUUID()}`;
}

function redact(value) {
  return String(value)
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/(ghp_|github_pat_|sk-)[A-Za-z0-9_-]+/g, "$1[REDACTED]")
    .replace(/([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY))\s*=\s*[^\s,;]+/g, "$1=[REDACTED]");
}

function loadPipeline(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new ContractError("PIPELINE_INVALID_JSON", `${file}: ${error.message}`);
  }
}

function route(request, pipelines) {
  const text = String(request || "").toLowerCase();
  const matches = pipelines.filter((pipeline) => (pipeline.triggers || []).some((trigger) => text.includes(String(trigger).toLowerCase())));
  if (matches.length === 1) return { pipeline: matches[0], mode: "exact" };
  if (matches.length > 1) return { pipelines: matches, mode: "ambiguous", requires_hitl: true };
  return { mode: "fallback", requires_hitl: true };
}

function validateOutput(output, requiredFields) {
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new ContractError("OUTPUT_WRONG_TYPE", "skill output must be an object");
  for (const field of requiredFields || []) {
    if (!(field in output)) throw new ContractError("OUTPUT_MISSING_REQUIRED", `missing required field: ${field}`);
  }
  return output;
}

function retryUntilSuccess(attempts, maxRetries, fn) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return { value: fn(attempt), attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
    }
  }
  throw new ContractError("RETRY_EXHAUSTED", `retry budget exhausted after ${maxRetries + 1} attempt(s): ${lastError.message}`);
}

function executeFixturePipeline(pipeline, options = {}) {
  const session = {
    session_id: options.sessionId || correlationId(),
    pipeline_id: pipeline.id || pipeline.pipeline_id || "fixture",
    status: "running",
    artifacts: {},
    gates: [],
    events: [],
  };
  const emitEvent = (event) => {
    const record = { session_id: session.session_id, pipeline_id: session.pipeline_id, ...event };
    session.events.push(record);
    if (options.persistEvents) appendEvent(record, options.eventsFile);
    if (options.emitEvent) options.emitEvent(record);
  };
  const pending = new Map();
  const phases = pipeline.phases || [];

  for (const phase of phases) {
    for (const task of phase.tasks || []) {
      const required = task.requires || [];
      const unavailable = required.filter((artifact) => !session.artifacts[artifact]);
      if (unavailable.length) throw new ContractError("ARTIFACT_NOT_READY", `${task.id || task.skill} requires unavailable artifact(s): ${unavailable.join(", ")}`);

      emitEvent({ event: "task", phase_id: phase.id, skill: task.id, status: "started" });
      if (task.type === "hitl_gate") {
        const decision = options.gateDecisions?.[task.id] || task.decision || "reject";
        session.gates.push({ task_id: task.id, decision });
        if (decision !== "approve") {
          session.status = decision === "timeout" ? "timed_out" : "rejected";
          emitEvent({ event: "gate", phase_id: phase.id, skill: task.id, status: session.status });
          return session;
        }
      } else if (task.async) {
        const result = options.asyncResults?.[task.id];
        if (result && result.status === "completed") {
          session.artifacts[task.output] = result.output;
          emitEvent({ event: "async", phase_id: phase.id, skill: task.id, status: "reconciled" });
        } else {
          pending.set(task.id, task);
          emitEvent({ event: "async", phase_id: phase.id, skill: task.id, status: "pending" });
        }
        continue;
      } else {
        const output = options.taskOutputs?.[task.id] || { [task.output || `${task.id}_result`]: true };
        if (task.required_fields) validateOutput(output, task.required_fields);
        if (task.output) session.artifacts[task.output] = output;
      }
      emitEvent({ event: "task", phase_id: phase.id, skill: task.id, status: "completed" });
    }
  }

  if (pending.size) {
    const taskIds = [...pending.keys()].join(", ");
    throw new ContractError("ASYNC_UNRECONCILED", `async task(s) remain pending at pipeline completion: ${taskIds}`);
  }

  session.status = "completed";
  emitEvent({ event: "pipeline", status: "completed" });
  return session;
}

function saveSession(file, session) {
  atomicWriteJson(file, session);
  return file;
}

function resumeSession(file) {
  return readJsonWithRecovery(file).value;
}

function main() {
  const fixture = process.argv[2];
  if (!fixture) {
    console.error("Usage: node scripts/conformance-harness.js <fixture.json>");
    process.exit(2);
  }
  const result = executeFixturePipeline(loadPipeline(path.resolve(fixture)), { gateDecisions: {} });
  console.log(JSON.stringify({ session_id: result.session_id, status: result.status, event_count: result.events.length }, null, 2));
}

if (require.main === module) main();

module.exports = {
  ContractError,
  correlationId,
  redact,
  loadPipeline,
  route,
  validateOutput,
  retryUntilSuccess,
  executeFixturePipeline,
  saveSession,
  resumeSession,
};

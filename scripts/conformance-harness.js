#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { atomicWriteJson, readJsonWithRecovery } = require("./lib/state-store");
const { appendEvent } = require("./lib/event-log");
const { assertMcpCapabilities, BudgetTracker, classifyFailure } = require("./lib/runtime-guards");
const { CircuitBreaker } = require("./lib/circuit-breaker");

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
    budget: null,
    circuit: null,
    completed_tasks: [],
  };
  const budgetTracker = options.budgetTracker || new BudgetTracker(options.budgetPolicy, { startedAt: Date.now() });
  const circuitBreaker = options.circuitBreaker || new CircuitBreaker(options.circuitBreakerOptions);
  session.budget = budgetTracker.snapshot();
  session.circuit = circuitBreaker.snapshot();
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

      try {
        circuitBreaker.assertCanCall();
        const guard = assertMcpCapabilities(task, { policy: options.mcpPolicy, profileName: options.mcpProfile, approval: options.approvedCapabilities === true });
        emitEvent({ event: "permission", phase_id: phase.id, skill: task.id, status: "allowed", message: `profile=${guard.profile}` });
        session.budget = budgetTracker.consume({ retries: task.retry_count, estimated_tokens: task.estimated_tokens, external_api_calls: task.external_api_calls });
        circuitBreaker.recordSuccess();
        session.circuit = circuitBreaker.snapshot();
      } catch (error) {
        circuitBreaker.recordFailure(classifyFailure(error));
        session.circuit = circuitBreaker.snapshot();
        session.status = "failed";
        emitEvent({ event: "failure", phase_id: phase.id, skill: task.id, status: "failed", error_code: error.code || "GUARD_FAILURE", message: classifyFailure(error) });
        throw error;
      }
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
      session.budget = budgetTracker.consume({ completed_task: true });
      session.completed_tasks.push(task.id || task.skill || `phase-${phase.id}`);
      emitEvent({ event: "task", phase_id: phase.id, skill: task.id, status: "completed" });
      if (options.checkpointFile) saveCheckpoint(options.checkpointFile, session, phase.id);
    }
  }

  if (pending.size) {
    const taskIds = [...pending.keys()].join(", ");
    throw new ContractError("ASYNC_UNRECONCILED", `async task(s) remain pending at pipeline completion: ${taskIds}`);
  }

  session.status = "completed";
  session.budget = budgetTracker.snapshot();
  emitEvent({ event: "pipeline", status: "completed", duration_ms: session.budget.elapsed_ms });
  return session;
}

function checkpointSnapshot(session, phaseId) {
  return {
    checkpoint_version: "1.0.0",
    saved_at: new Date().toISOString(),
    session_id: session.session_id,
    pipeline_id: session.pipeline_id,
    phase_id: phaseId,
    status: session.status,
    completed_tasks: [...session.completed_tasks],
    artifact_names: Object.keys(session.artifacts),
    gate_decisions: session.gates.map((gate) => ({ task_id: gate.task_id, decision: gate.decision })),
    budget: session.budget,
    circuit: session.circuit,
    raw_artifacts_included: false,
  };
}

function saveCheckpoint(file, session, phaseId) {
  atomicWriteJson(file, checkpointSnapshot(session, phaseId));
  return file;
}

function resumeCheckpoint(file) {
  return readJsonWithRecovery(file).value;
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
  checkpointSnapshot,
  saveCheckpoint,
  resumeCheckpoint,
};

#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, ".ai-workflow/adapter-registry.json"), "utf8"));
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const strict = args.includes("--strict");
const runtimeIndex = args.indexOf("--runtime");
const requestedRuntime = runtimeIndex >= 0 ? args[runtimeIndex + 1] : null;
const failures = [];

function parseVersion(value) {
  const match = String(value || "").match(/(?:^|\s|v)(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compare(left, right) {
  for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

function satisfies(version, range) {
  const parsed = parseVersion(version);
  const match = String(range || "").match(/^>=\s*(\d+\.\d+\.\d+)$/);
  if (!parsed || !match) return null;
  return compare(parsed, parseVersion(match[1])) >= 0;
}

function sanitized(value, limit = 160) {
  return String(value || "").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]+/g, "[REDACTED]").replace(/\s+/g, " ").trim().slice(0, limit);
}

function hostResult(id, descriptor) {
  const projection = descriptor.projection_path ? path.join(root, descriptor.projection_path) : null;
  return {
    runtime_id: id,
    adapter_id: id,
    runtime_family: descriptor.runtime_family,
    tier: descriptor.tier,
    declared_version_range: descriptor.version_range,
    status: "host-verification-required",
    version: null,
    projection_present: Boolean(projection && fs.existsSync(projection)),
    detail: "Host/editor lifecycle and version must be verified by the operator; no host session was started.",
  };
}

function terminalResult(id, descriptor, adapter) {
  const envVar = descriptor.env_var || (id === "opencode" ? "AIW_OPENCODE_BIN" : null);
  const executable = (envVar && process.env[envVar]) || descriptor.executable || id;
  const result = spawnSync(executable, ["--version"], { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 64 * 1024 });
  const output = sanitized(result.stdout || result.stderr);
  if (result.error || result.status !== 0 || !output) {
    return {
      runtime_id: id,
      adapter_id: id,
      runtime_family: descriptor.runtime_family,
      tier: descriptor.tier,
      declared_version_range: descriptor.version_range,
      executable,
      status: "unavailable",
      version: null,
      detail: `Version-only check unavailable: ${sanitized(result.error?.message || output || "command failed")}`,
    };
  }
  const compatibility = satisfies(output, descriptor.version_range);
  const parsedVersion = parseVersion(output);
  const status = compatibility === null ? "range-unpinned" : compatibility ? "available" : "unsupported-version";
  return {
    runtime_id: id,
    adapter_id: id,
    runtime_family: descriptor.runtime_family,
    tier: descriptor.tier,
    declared_version_range: descriptor.version_range,
    executable,
    status,
    version: parsedVersion ? parsedVersion.join(".") : output.split(" ")[0],
    detail: compatibility === null ? "Runtime responded, but its declared range is operator-defined and requires review." : compatibility ? "Runtime version satisfies the declared range." : "Runtime version does not satisfy the declared range.",
  };
}

function inspect(id) {
  const registered = registry.adapters?.[id];
  if (!registered) return { runtime_id: id, adapter_id: id, status: "unregistered", detail: "Runtime is not in the canonical adapter registry." };
  try {
    const adapter = require(path.join(root, registered.entrypoint, "index.js"));
    const descriptor = adapter.descriptor;
    if (descriptor.runtime_family === "terminal-agent") return terminalResult(id, descriptor, adapter);
    return hostResult(id, descriptor);
  } catch (error) {
    return { runtime_id: id, adapter_id: id, status: "adapter-load-failed", detail: sanitized(error.message) };
  }
}

const runtimeIds = requestedRuntime ? [requestedRuntime] : Object.keys(registry.adapters || {});
const results = runtimeIds.map(inspect);
for (const result of results) {
  const blocking = ["unavailable", "unsupported-version", "unregistered", "adapter-load-failed"].includes(result.status);
  if (strict && (blocking || result.status === "host-verification-required" || result.status === "range-unpinned")) failures.push(`${result.runtime_id}: ${result.status}`);
}

if (jsonOutput) console.log(JSON.stringify({ tool: "runtime-version-watch", strict, results, failures }, null, 2));
else {
  console.log(`Runtime version watch (${strict ? "strict" : "informational"})`);
  for (const result of results) console.log(`${result.runtime_id}: ${result.status}${result.version ? ` (${result.version})` : ""} — ${result.detail}`);
}
if (failures.length) {
  console.error(`Runtime version watch blocked (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("Runtime version watch completed without an unreported compatibility result.");

#!/usr/bin/env node
// scripts/check-mcp-deps.js — S1 MCP dependency verification for one runtime.
//
// Checks, per enabled manifest server compatible with the adapter:
//   - transport projectable (stdio/http/sse supported per catalog descriptor)
//   - launch command executable resolvable (PATH lookup or absolute path)
//   - env/secret REFERENCE presence (name existence only — values never read,
//     printed, persisted, or logged)
// Modes: --warn (exit 0 always; prints WARN lines) | --strict (exit 1 if any
// required server is unusable). disabled servers are always skipped.
//
// Usage: node scripts/check-mcp-deps.js --adapter <id> --warn|--strict
// Exit 0 usable-or-optional-issues (warn) / all usable (strict);
// exit 1 required-unusable (strict) or usage/catalog error.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REF_RE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function usage() {
  console.error("Usage: node scripts/check-mcp-deps.js --adapter <id> --warn|--strict");
  process.exit(2);
}

const argv = process.argv.slice(2);
const adapterId = argv[argv.indexOf("--adapter") + 1];
const strict = argv.includes("--strict");
if (!adapterId || (!argv.includes("--warn") && !strict)) usage();

const manifest = JSON.parse(fs.readFileSync(process.env.AIW_MCP_MANIFEST || path.join(ROOT, "config/mcp-manifest.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "config/agent-runtime-catalog.json"), "utf8"));
const adapter = (catalog.adapters || []).find((a) => a.id === adapterId);
if (!adapter) {
  console.error(`  FAIL: unknown adapter '${adapterId}'`);
  process.exit(2);
}

function commandResolvable(command) {
  const exe = command[0];
  if (exe.includes("/")) {
    try {
      fs.accessSync(exe, fs.constants.X_OK);
      return true;
    } catch {
      return path.isAbsolute(exe) ? false : commandOnPath(exe);
    }
  }
  return commandOnPath(exe);
}

function commandOnPath(exe) {
  const dirs = (process.env.PATH || "").split(path.delimiter);
  const names = process.platform === "win32" ? [exe, `${exe}.exe`, `${exe}.cmd`] : [exe];
  for (const dir of dirs) {
    for (const name of names) {
      try {
        fs.accessSync(path.join(dir, name), fs.constants.X_OK);
        return true;
      } catch {
        /* continue */
      }
    }
  }
  return false;
}

let requiredFailures = 0;
let warnings = 0;

for (const [id, server] of Object.entries(manifest.servers || {})) {
  if (!server.enabled) continue;
  if (!(server.compatibility || []).includes(adapterId)) continue;
  const problems = [];
  if (!["stdio", "http", "sse"].includes(server.transport)) {
    problems.push(`unsupported transport '${server.transport}'`);
  }
  if (server.transport === "stdio" && !commandResolvable(server.command || [])) {
    problems.push(`command not found: ${(server.command || ["?"])[0]}`);
  }
  const missing = [];
  for (const ref of [...Object.values(server.env_refs || {}), ...Object.values(server.headers || {})]) {
    const match = typeof ref === "string" && ref.match(REF_RE);
    if (match && !(match[1] in process.env)) missing.push(match[1]);
  }
  if (missing.length > 0) problems.push(`missing env refs: ${missing.join(", ")}`);
  if (problems.length === 0) {
    console.log(`  OK: ${id} usable for ${adapterId}`);
    continue;
  }
  const detail = problems.join("; ");
  if (server.required) {
    console.error(`  FAIL (required): ${id} unusable for ${adapterId} — ${detail}`);
    requiredFailures += 1;
  } else {
    console.error(`  WARN (optional): ${id} degraded for ${adapterId} — ${detail}`);
    warnings += 1;
  }
}

if (strict && requiredFailures > 0) {
  console.error(`  MCP dependency gate: ${requiredFailures} required server(s) unusable — start blocked. Fix env/commands or run: aiw sync-runtimes`);
  process.exit(1);
}
if (warnings > 0) console.error(`  MCP notes: ${warnings} optional server warning(s) — continuing.`);
process.exit(0);

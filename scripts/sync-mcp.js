#!/usr/bin/env node
// scripts/sync-mcp.js — S1 canonical MCP projection generator.
//
// Authority: config/mcp-manifest.json (sole source). Projections:
//   - opencode.json@mcp            (legacy authority migrated to generated)
//   - .mcp.json                    (Claude Code + Copilot CLI shared project scope, Q2)
//   - .cursor/mcp.json             (Cursor project scope)
// Secret refs are NEVER resolved: ${VAR} is translated per-target
// ({env:VAR} / ${VAR} / ${env:VAR}) but values are never read.
//
// Usage: node scripts/sync-mcp.js --write | --check
// Deterministic: manifest order, canonical JSON form (indent=2, ASCII, no
// trailing newline — byte-compatible with scripts/canonical-json.py).
// Exit 0 clean; exit 1 on drift (--check), validation failure, or write error.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
// AIW_MCP_MANIFEST overrides the manifest path (hermetic tests only;
// production always uses config/mcp-manifest.json).
const MANIFEST = process.env.AIW_MCP_MANIFEST || path.join(ROOT, "config/mcp-manifest.json");
const OPENCODE = path.join(ROOT, "opencode.json");
const CLAUDE = path.join(ROOT, ".mcp.json");
const CURSOR = path.join(ROOT, ".cursor/mcp.json");

const REF_RE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function fail(message) {
  console.error(`  FAIL: ${message}`);
  process.exitCode = 1;
}

// Canonical JSON: indent=2, ensure_ascii, no trailing newline.
function canonical(value) {
  return JSON.stringify(value, null, 2).replace(
    /[\u0080-\uFFFF]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const servers = manifest.servers || {};
  for (const [id, server] of Object.entries(servers)) {
    for (const [name, value] of Object.entries(server.env_refs || {})) {
      if (!REF_RE.test(value)) {
        fail(`manifest server '${id}' env_ref '${name}' is not a \${VAR} reference (secret values forbidden)`);
      }
    }
    for (const [name, value] of Object.entries(server.headers || {})) {
      if (typeof value === "string" && /^(ghp_|github_pat_|sk-(live|ant)-|xox[bpas]-)/.test(value)) {
        fail(`manifest server '${id}' header '${name}' looks like a literal secret`);
      }
    }
    if (server.transport === "stdio" && (!Array.isArray(server.command) || server.command.length === 0)) {
      fail(`manifest server '${id}' stdio transport requires a non-empty command array`);
    }
    if ((server.transport === "http" || server.transport === "sse") && !server.url) {
      fail(`manifest server '${id}' ${server.transport} transport requires url`);
    }
    if (server.trust === "auto") {
      console.error(`  WARN: manifest server '${id}' trust:auto has no safe runtime mapping; projecting conservatively (native approval)`);
    }
  }
  if (process.exitCode) process.exit(process.exitCode);
  return servers;
}

function enabledServers(servers) {
  return Object.entries(servers).filter(([, s]) => s.enabled);
}

// --- Projections -----------------------------------------------------------

function projectOpenCode(servers) {
  // Faithful migration: every manifest server (enabled AND disabled) is
  // projected with its enabled flag preserved, and ${VAR} refs pass through
  // verbatim (this repo's OpenCode v1 setup uses ${VAR}; do not rewrite).
  const block = {};
  for (const [id, s] of Object.entries(servers)) {
    if (s.transport === "stdio") {
      const entry = { type: "local", command: [...s.command, ...(s.args || [])] };
      if (Object.keys(s.env_refs || {}).length > 0) entry.env = { ...s.env_refs };
      entry.enabled = s.enabled;
      block[id] = entry;
    } else {
      const entry = { type: "remote", url: s.url };
      if (Object.keys(s.headers || {}).length > 0) entry.headers = { ...s.headers };
      entry.enabled = s.enabled;
      block[id] = entry;
    }
  }
  return block;
}

function projectClaude(servers) {
  const block = {};
  for (const [id, s] of enabledServers(servers)) {
    if (s.transport === "stdio") {
      const [command, ...rest] = [...s.command, ...(s.args || [])];
      const entry = { command, args: rest };
      if (Object.keys(s.env_refs || {}).length > 0) entry.env = { ...s.env_refs };
      block[id] = entry;
    } else {
      const entry = { type: "http", url: s.url };
      if (Object.keys(s.headers || {}).length > 0) entry.headers = { ...s.headers };
      block[id] = entry;
    }
  }
  return { mcpServers: block };
}

function projectCursor(servers) {
  const block = {};
  for (const [id, s] of enabledServers(servers)) {
    if (s.transport === "stdio") {
      const [command, ...rest] = [...s.command, ...(s.args || [])];
      const entry = { command, args: rest };
      if (Object.keys(s.env_refs || {}).length > 0) {
        entry.env = {};
        for (const [name, ref] of Object.entries(s.env_refs)) {
          entry.env[name] = `\${env:${ref.slice(2, -1)}}`;
        }
      }
      block[id] = entry;
    } else {
      const entry = { url: s.url };
      if (Object.keys(s.headers || {}).length > 0) entry.headers = { ...s.headers };
      block[id] = entry;
    }
  }
  return { mcpServers: block };
}

// --- Driver ----------------------------------------------------------------

function writeIfChanged(filePath, content, changes) {
  let current = null;
  try {
    current = fs.readFileSync(filePath, "utf8");
  } catch {
    current = null;
  }
  if (current === content) return "up-to-date";
  if (process.argv.includes("--check")) {
    fail(current === null ? `missing generated file: ${path.relative(ROOT, filePath)}` : `drift: ${path.relative(ROOT, filePath)} differs from canonical projection`);
    return "drift";
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  changes.push(path.relative(ROOT, filePath));
  return "updated";
}

function main() {
  const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--write") ? "write" : null;
  if (!mode) {
    console.error("Usage: node scripts/sync-mcp.js --write | --check");
    process.exit(2);
  }
  const servers = loadManifest();

  // opencode.json: replace only the mcp block, preserve everything else byte-form.
  const opencode = JSON.parse(fs.readFileSync(OPENCODE, "utf8"));
  opencode.mcp = projectOpenCode(servers);
  const changes = [];
  const r1 = writeIfChanged(OPENCODE, canonical(opencode), changes);
  const r2 = writeIfChanged(CLAUDE, canonical(projectClaude(servers)), changes);
  const r3 = writeIfChanged(CURSOR, canonical(projectCursor(servers)), changes);

  if (mode === "check") {
    if (!process.exitCode) console.log("  PASS: MCP projections in sync (opencode.json, .mcp.json, .cursor/mcp.json)");
    return;
  }
  if (!process.exitCode) {
    if (changes.length === 0) console.log("  MCP projections up to date (no changes).");
    else console.log(`  MCP projections updated: ${changes.join(", ")}`);
  }
}

main();

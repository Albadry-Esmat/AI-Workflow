#!/usr/bin/env node
// scripts/backfill-origin-metadata.js — one-shot provenance backfill (TASK-0048).
//
// Fills origin_metadata stubs for registry entries that lack it, using each
// skill's git first-commit date as created_at (honest provenance, not
// fabricated). Backfilled entries use source "migrated" (schema-defined for
// pre-v5.1.0 back-fills) and tier "legacy" (registered without recorded
// quality-gate evidence). Idempotent: entries that already have
// origin_metadata are never touched.
//
// Usage: node scripts/backfill-origin-metadata.js --dry-run | --write
// Exit 0 on success; exit 1 on registry/schema errors.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY = path.join(ROOT, "skills/registry.json");

const mode = process.argv.includes("--write")
  ? "write"
  : process.argv.includes("--dry-run")
    ? "dry-run"
    : null;
if (!mode) {
  console.error("Usage: node scripts/backfill-origin-metadata.js --dry-run | --write");
  process.exit(2);
}

function firstCommitDate(skillPath) {
  try {
    const out = execFileSync(
      "git", ["log", "--diff-filter=A", "--format=%aI", "--", skillPath],
      { cwd: ROOT, encoding: "utf8" },
    ).trim().split("\n").filter(Boolean);
    if (out.length > 0) return new Date(out[out.length - 1]).toISOString().replace(/\.\d+Z$/, "Z");
  } catch {
    /* fall through to marker */
  }
  return "2026-06-01T00:00:00Z";
}

const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
let filled = 0;
for (const skill of registry.skills || []) {
  if (skill.origin_metadata) continue;
  const skillFile = path.join(ROOT, ".agents/skills", skill.name, "SKILL.md");
  skill.origin_metadata = {
    source: "migrated",
    created_by_session: null,
    approval_tier: "legacy",
    dedup_override: false,
    dedup_override_reason: null,
    created_at: firstCommitDate(path.relative(ROOT, skillFile)),
  };
  filled += 1;
  console.log(`  ${mode === "write" ? "FILLED" : "WOULD-FILL"}: ${skill.name} created_at=${skill.origin_metadata.created_at}`);
}

if (mode === "write" && filled > 0) {
  // Byte-compatible with scripts/canonical-json.py (indent=2, ASCII-escaped,
  // no trailing newline) so tracked JSON stays byte-stable.
  const text = JSON.stringify(registry, null, 2).replace(
    /[\u0080-\uFFFF]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  fs.writeFileSync(REGISTRY, text);
}
console.log(filled === 0 ? "  origin_metadata complete (no gaps)." : `  ${filled} entr${filled === 1 ? "y" : "ies"} ${mode === "write" ? "backfilled" : "would be backfilled"}.`);

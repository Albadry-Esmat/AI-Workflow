#!/usr/bin/env node
/**
 * Verify the exact publication artifact consumed by ASE-OS-Website.
 *
 * The AI-Workflow repository is the source of truth. The target is normally
 * website/data/ in this repository or data/ in the standalone website repo.
 * The verifier intentionally compares both file sets and file contents so
 * deleted skills cannot survive in a mirror unnoticed.
 *
 * Usage:
 *   node scripts/verify-website-sync.js --target website/data --check
 *   node scripts/verify-website-sync.js --target /tmp/site/data --report report.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const valueFor = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const TARGET = path.resolve(ROOT, valueFor("--target", "website/data"));
const REPORT_PATH = valueFor("--report", "");
const CHECK = args.includes("--check");
const JSON_OUTPUT = args.includes("--json");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) result.push(path.relative(directory, full).split(path.sep).join("/"));
    }
  };
  visit(directory);
  return result.sort();
}

function addFile(map, relativePath, sourcePath) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }
  map.set(relativePath, sourcePath);
}

function addDirectory(map, sourceDirectory, destinationDirectory, matcher) {
  if (!fs.existsSync(sourceDirectory)) throw new Error(`Missing source directory: ${sourceDirectory}`);
  for (const relative of listFiles(sourceDirectory)) {
    const basename = path.basename(relative);
    const matches = typeof matcher === "function" ? matcher(relative) : basename === matcher;
    if (!matches) continue;
    addFile(map, path.posix.join(destinationDirectory, relative), path.join(sourceDirectory, relative));
  }
}

function expectedFiles() {
  const files = new Map();
  addFile(files, "skills/index.yaml", path.join(ROOT, "skills/index.yaml"));
  addFile(files, "skills/registry.json", path.join(ROOT, "skills/registry.json"));
  addFile(files, "skills/graph/skill-graph.yaml", path.join(ROOT, "skills/graph/skill-graph.yaml"));
  addDirectory(files, path.join(ROOT, "skills/pipelines"), "skills/pipelines", (relative) => relative.endsWith(".json"));
  addFile(files, "docs/changelog.md", path.join(ROOT, "docs/changelog.md"));
  addFile(files, "opencode.json", path.join(ROOT, "opencode.json"));
  addFile(files, "site-content.json", path.join(ROOT, "website/data/site-content.json"));
  addDirectory(files, path.join(ROOT, ".opencode/skills"), ".opencode/skills", "SKILL.md");
  return files;
}

function sourceCommit() {
  try {
    return cp.execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function registryVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "skills/registry.json"), "utf8")).version || null;
  } catch {
    return null;
  }
}

function buildReport() {
  const expected = expectedFiles();
  const actual = new Set(listFiles(TARGET));
  const entries = [];
  const missing = [];
  const extra = [];
  const modified = [];
  const matched = [];

  for (const [relative, sourcePath] of expected.entries()) {
    const targetPath = path.join(TARGET, relative);
    if (!fs.existsSync(targetPath)) {
      missing.push(relative);
      entries.push({ path: relative, status: "MISSING" });
      continue;
    }
    const sourceHash = sha256(sourcePath);
    const targetHash = sha256(targetPath);
    if (sourceHash !== targetHash) {
      modified.push(relative);
      entries.push({ path: relative, status: "MODIFIED", sourceSha256: sourceHash, targetSha256: targetHash });
    } else {
      matched.push(relative);
      entries.push({ path: relative, status: "MATCHED", sha256: sourceHash, bytes: fs.statSync(sourcePath).size });
    }
    actual.delete(relative);
  }

  for (const relative of [...actual].sort()) {
    extra.push(relative);
    entries.push({ path: relative, status: "EXTRA" });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: 1,
    sourceCommit: sourceCommit(),
    registryVersion: registryVersion(),
    sourceRoot: ROOT,
    target: TARGET,
    summary: {
      expected: expected.size,
      matched: matched.length,
      missing: missing.length,
      modified: modified.length,
      extra: extra.length,
      ok: missing.length === 0 && modified.length === 0 && extra.length === 0,
    },
    missing,
    modified,
    extra,
    entries,
  };
}

try {
  const report = buildReport();
  if (REPORT_PATH) {
    fs.mkdirSync(path.dirname(path.resolve(REPORT_PATH)), { recursive: true });
    fs.writeFileSync(path.resolve(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`Publication verification: ${report.summary.ok ? "PASS" : "FAIL"}`);
    console.log(`  expected=${report.summary.expected} matched=${report.summary.matched} missing=${report.summary.missing} modified=${report.summary.modified} extra=${report.summary.extra}`);
    for (const status of ["MISSING", "MODIFIED", "EXTRA"]) {
      const paths = report.entries.filter((entry) => entry.status === status).map((entry) => entry.path);
      for (const item of paths) console.log(`  ${status}: ${item}`);
    }
    console.log(`  sourceCommit=${report.sourceCommit || "unknown"} registryVersion=${report.registryVersion || "unknown"}`);
  }
  process.exit(CHECK && !report.summary.ok ? 1 : 0);
} catch (error) {
  console.error(`Publication verification error: ${error.message}`);
  process.exit(1);
}

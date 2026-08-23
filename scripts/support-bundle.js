#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync, spawnSync } = require("child_process");
const { atomicWriteJson } = require("./lib/state-store");
const { redact } = require("./conformance-harness");

const root = path.resolve(__dirname, "..");
const defaultDirectory = path.join(root, "support-bundles");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  return redact((result.stdout || "") + (result.stderr || "")).trim();
}

function inventory(directory) {
  if (!fs.existsSync(directory)) return { exists: false, files: [] };
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else {
        const relative = path.relative(directory, file);
        files.push({ path: relative, bytes: fs.statSync(file).size });
      }
    }
  }
  walk(directory);
  return { exists: true, files };
}

function main() {
  const requested = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
  const outputDirectory = path.resolve(requested || defaultDirectory);
  const bundleName = `aiw-support-${new Date().toISOString().replace(/[T:.Z]/g, "-").replace(/-+$/, "")}-${crypto.randomBytes(3).toString("hex")}`;
  const bundleDirectory = path.join(outputDirectory, bundleName);
  fs.mkdirSync(bundleDirectory, { recursive: true, mode: 0o700 });

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const compatibility = JSON.parse(fs.readFileSync(path.join(root, "compatibility.json"), "utf8"));
  const git = (args) => {
    try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); } catch (_) { return "unavailable"; }
  };
  const manifest = {
    bundle_version: "1.0.0",
    generated_at: new Date().toISOString(),
    framework_version: compatibility.framework_version,
    cli_version: packageJson.version,
    schema_version: compatibility.schema_version,
    node_version: process.version,
    platform: `${process.platform}/${process.arch}`,
    git_branch: git(["branch", "--show-current"]),
    git_commit: git(["rev-parse", "HEAD"]),
    working_tree_changes: git(["status", "--short"]).split("\n").filter(Boolean).length,
    state_inventory: inventory(path.join(root, ".opencode", "state")),
    included_files: ["manifest.json", "diagnostics.txt", "state-inventory.json"],
    excluded_data: [".env values", "raw session JSON", "raw pipeline artifacts", "MCP payloads", "authorization headers"],
  };
  atomicWriteJson(path.join(bundleDirectory, "manifest.json"), manifest, { mode: 0o600 });
  atomicWriteJson(path.join(bundleDirectory, "state-inventory.json"), manifest.state_inventory, { mode: 0o600 });

  const diagnostics = [
    "AI Workflow sanitized support bundle",
    `Generated: ${manifest.generated_at}`,
    `Framework: ${manifest.framework_version}; CLI: ${manifest.cli_version}; Schema: ${manifest.schema_version}`,
    `Node: ${manifest.node_version}; Platform: ${manifest.platform}`,
    `Git branch: ${manifest.git_branch}`,
    `Git commit: ${manifest.git_commit}`,
    `Working-tree changes: ${manifest.working_tree_changes}`,
    `OpenCode: ${run("opencode", ["--version"]) || "unavailable"}`,
    "",
    "--- Semantic pipeline validation ---",
    run(process.execPath, ["scripts/validate-pipelines.js"]) || "unavailable",
    "",
    "--- Security check ---",
    run(process.execPath, ["scripts/security-check.js"]) || "unavailable",
    "",
    "--- State handling ---",
    "Only state filenames and byte counts are included. Raw state content is intentionally excluded.",
  ].join("\n");
  fs.writeFileSync(path.join(bundleDirectory, "diagnostics.txt"), redact(`${diagnostics}\n`), { mode: 0o600 });
  console.log(path.relative(root, bundleDirectory));
}

main();

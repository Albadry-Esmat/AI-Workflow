#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(__dirname, "documentation-policy.json");
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));

function usage() {
  console.log("Usage: node scripts/verify-documentation-policy.js [--base <git-ref>]");
  console.log("Checks that every changed area updates the changelog and its affected documentation.");
}

function globToRegExp(glob) {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[|\\{}()[\]^$+.*]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function matches(pathName, pattern) {
  return globToRegExp(pattern).test(pathName);
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(0);
  }
  const baseIndex = args.indexOf("--base");
  if (baseIndex !== -1 && !args[baseIndex + 1]) {
    throw new Error("--base requires a git ref");
  }
  return baseIndex === -1 ? null : args[baseIndex + 1];
}

function changedFiles(baseRef) {
  const names = new Set();
  if (baseRef) {
    try {
      git(["diff", "--name-only", `${baseRef}...HEAD`])
        .split("\n")
        .filter(Boolean)
        .forEach((name) => names.add(name));
    } catch (error) {
      throw new Error(`Unable to compare against base ref '${baseRef}': ${error.message}`);
    }
  } else {
    git(["diff", "--name-only", "HEAD"])
      .split("\n")
      .filter(Boolean)
      .forEach((name) => names.add(name));
    git(["diff", "--cached", "--name-only"])
      .split("\n")
      .filter(Boolean)
      .forEach((name) => names.add(name));
    git(["ls-files", "--others", "--exclude-standard"])
      .split("\n")
      .filter(Boolean)
      .forEach((name) => names.add(name));
  }
  return [...names].sort();
}

function isIgnored(file) {
  return policy.ignored_paths.some((pattern) => matches(file, pattern));
}

function isDocumentation(file) {
  return file === "README.md" || file === "CONTRIBUTING.md" || file.startsWith("docs/");
}

function main() {
  const cliBase = parseArgs();
  let baseRef = cliBase || process.env.AIW_DOCS_BASE || null;
  if (baseRef && /^0+$/.test(baseRef)) {
    try {
      baseRef = git(["rev-parse", "HEAD^"]);
    } catch (error) {
      baseRef = null;
    }
  }
  const changed = changedFiles(baseRef).filter((file) => !isIgnored(file));

  if (changed.length === 0) {
    console.log("DOCUMENTATION_POLICY_PASSED: no non-ignored changes detected");
    return;
  }

  const changedSet = new Set(changed);
  const missing = new Set();
  const matchedRules = new Set();

  for (const required of policy.always_required) {
    if (!changedSet.has(required)) missing.add(required);
  }

  for (const file of changed) {
    if (isDocumentation(file)) continue;
    for (const rule of policy.rules) {
      if (rule.paths.some((pattern) => matches(file, pattern))) {
        matchedRules.add(rule.id);
        for (const required of rule.required_docs) {
          if (!changedSet.has(required)) missing.add(required);
        }
      }
    }
  }

  if (missing.size > 0) {
    console.error("DOCUMENTATION_POLICY_FAILED");
    console.error("");
    console.error("Changed files:");
    changed.forEach((file) => console.error(`  - ${file}`));
    console.error("");
    console.error("Required documentation updates missing from this change:");
    [...missing].sort().forEach((file) => console.error(`  - ${file}`));
    console.error("");
    console.error("Update all affected guides and docs/changelog.md, then rerun:");
    console.error("  node scripts/verify-documentation-policy.js");
    process.exit(1);
  }

  console.log(`DOCUMENTATION_POLICY_PASSED: ${changed.length} changed file(s), ${matchedRules.size} affected area(s)`);
  console.log("  Required changelog and affected documentation are present.");
}

try {
  main();
} catch (error) {
  console.error(`DOCUMENTATION_POLICY_ERROR: ${error.message}`);
  process.exit(1);
}

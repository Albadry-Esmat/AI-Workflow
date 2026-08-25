#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const indexPath = path.join(ROOT, "skills", "index.yaml");
const index = yaml.load(fs.readFileSync(indexPath, "utf8"));
const skills = Array.isArray(index) ? index : index?.skills;
if (!Array.isArray(skills)) throw new Error("skills/index.yaml must contain a skills array");

let failures = 0;
for (const skill of skills) {
  const skillPath = skill.executable_skill || skill.reference_path || "";
  if (!skillPath) continue;
  const filePath = path.join(ROOT, skillPath);
  let raw;
  try { raw = fs.readFileSync(filePath, "utf8"); } catch { raw = ""; }
  const version = raw.match(/^version:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "FILE_NOT_FOUND";
  if (skill.version !== version) {
    console.log(`  FAIL: ${skillPath} index.yaml=${skill.version} SKILL.md=${version}`);
    failures++;
  } else {
    console.log(`  PASS: ${skillPath}`);
  }
}

const communitySkills = skills.filter((skill) => skill.origin_metadata?.source === "community");
for (const skill of communitySkills) {
  const skillPath = skill.executable_skill || skill.reference_path || "";
  const expected = skill.origin_metadata?.sha256;
  const filePath = path.join(ROOT, skillPath);
  if (!expected) {
    console.log(`  FAIL [${skill.id || "?"} ${skill.name || "?"}]: origin_metadata.sha256 missing`);
    failures++;
    continue;
  }
  if (!fs.existsSync(filePath)) {
    console.log(`  FAIL [${skill.id || "?"} ${skill.name || "?"}]: SKILL.md not found at ${skillPath}`);
    failures++;
    continue;
  }
  const actual = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  if (actual !== expected) {
    console.log(`  FAIL [${skill.id || "?"} ${skill.name || "?"}]: SHA-256 mismatch`);
    failures++;
  } else {
    console.log(`  PASS [${skill.id || "?"} ${skill.name || "?"}]: SHA-256 verified`);
  }
}

if (communitySkills.length === 0) console.log("  PASS: No community skills installed");
process.exit(failures === 0 ? 0 : 1);

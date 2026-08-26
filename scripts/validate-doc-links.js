#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const files = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
}
walk(path.join(ROOT, "docs"));
walk(path.join(ROOT, "examples"));
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.join(ROOT, entry.name));
}

const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
const broken = [];
for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim();
    if (/^(?:https?:\/\/|mailto:|#)/.test(rawTarget)) continue;
    const pathPart = rawTarget.split("#")[0];
    if (!pathPart) continue;
    const target = path.resolve(path.dirname(filePath), pathPart);
    if (!fs.existsSync(target)) {
      broken.push(`  FAIL: ${path.relative(ROOT, filePath)} → ${rawTarget}`);
    }
  }
}

if (broken.length > 0) {
  console.error("=== Broken internal links ===");
  console.error(broken.join("\n"));
  process.exit(1);
}
console.log(`  PASS: All internal Markdown links resolve (${files.length} files checked)`);

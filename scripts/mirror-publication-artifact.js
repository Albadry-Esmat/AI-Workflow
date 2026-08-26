#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg) {
  console.error("Usage: node scripts/mirror-publication-artifact.js <source> <target>");
  process.exit(2);
}
const source = path.resolve(sourceArg);
const target = path.resolve(targetArg);

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) result.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  walk(root);
  return result.sort();
}
function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function removeEmptyDirectories(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const full = path.join(directory, entry.name);
      removeEmptyDirectories(full);
      if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    }
  }
}
if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error(`Source directory not found: ${source}`);
fs.mkdirSync(target, { recursive: true });
const sourceFiles = filesUnder(source);
const sourceSet = new Set(sourceFiles);
for (const relative of filesUnder(target)) {
  if (!sourceSet.has(relative)) fs.rmSync(path.join(target, relative));
}
for (const relative of sourceFiles) {
  const from = path.join(source, relative);
  const to = path.join(target, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (!fs.existsSync(to) || hash(from) !== hash(to)) fs.copyFileSync(from, to);
}
removeEmptyDirectories(target);
const targetFiles = filesUnder(target);
const mismatches = [];
if (sourceFiles.length !== targetFiles.length) mismatches.push(`file count ${sourceFiles.length} != ${targetFiles.length}`);
for (const relative of sourceFiles) {
  if (!fs.existsSync(path.join(target, relative)) || hash(path.join(source, relative)) !== hash(path.join(target, relative))) mismatches.push(relative);
}
if (mismatches.length) {
  console.error(`Publication mirror failed: ${mismatches.join(", ")}`);
  process.exit(1);
}
console.log(`Publication mirror verified: ${sourceFiles.length} files copied exactly`);

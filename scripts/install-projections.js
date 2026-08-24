#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function value(flag, fallback) { const i = process.argv.indexOf(flag); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; }
const source = path.resolve(value("--source", path.join(process.cwd(), ".ai-workflow", "generated")));
const target = path.resolve(value("--target", process.cwd()));
const confirmed = process.argv.includes("--confirm");
const overwrite = process.argv.includes("--overwrite");
const backupRoot = path.resolve(value("--backup-dir", path.join(target, ".ai-workflow", "projection-backups")));
if (!fs.existsSync(source) || !fs.existsSync(path.join(source, "manifest.json"))) { console.error(`PROJECTION_SOURCE_INVALID: ${source}`); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
const files = Object.keys(manifest.files || {}).sort();
const conflicts = files.filter((relative) => fs.existsSync(path.join(target, relative)));
console.log(JSON.stringify({ source, target, files: files.length, conflicts, confirmed, overwrite }, null, 2));
if (!confirmed) { console.log("DRY_RUN_ONLY: re-run with --confirm after reviewing the projected diff"); process.exit(conflicts.length ? 2 : 0); }
if (conflicts.length && !overwrite) { console.error("PROJECTION_OVERWRITE_BLOCKED: existing files require --overwrite and an explicit review"); conflicts.forEach((file) => console.error(`  CONFLICT: ${file}`)); process.exit(1); }
const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(backupRoot, backupStamp);
if (conflicts.length) fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
for (const relative of files) {
  const sourceFile = path.join(source, relative);
  const targetFile = path.join(target, relative);
  if (fs.existsSync(targetFile)) {
    const backupFile = path.join(backupDir, relative);
    fs.mkdirSync(path.dirname(backupFile), { recursive: true, mode: 0o700 });
    fs.copyFileSync(targetFile, backupFile);
  }
  fs.mkdirSync(path.dirname(targetFile), { recursive: true, mode: 0o700 });
  const temporary = `${targetFile}.aiw-${crypto.randomUUID()}.tmp`;
  fs.copyFileSync(sourceFile, temporary);
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, targetFile);
}
console.log(`Installed ${files.length} projection file(s) to ${target}.`);
if (conflicts.length) console.log(`Existing files backed up under ${backupDir}.`);

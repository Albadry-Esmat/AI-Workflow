#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { atomicWriteJson, withLock } = require("./lib/state-store");

const root = path.resolve(__dirname, "..");
const stateDir = process.env.AIW_STATE_DIR || path.join(root, ".opencode", "state");
const backupRoot = process.env.AIW_BACKUP_ROOT || path.join(root, "backups");
const lockFile = process.env.AIW_STATE_LOCK || path.join(root, ".opencode", "state.lock");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full));
    else if (entry.isFile()) result.push(full);
  }
  return result.sort();
}

function copyTree(source, destination) {
  for (const file of listFiles(source)) {
    const relative = path.relative(source, file);
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
}

function makeManifest(directory, relativeTo) {
  return {
    manifest_version: "1.0.0",
    created_at: new Date().toISOString(),
    source: path.relative(root, relativeTo),
    files: listFiles(directory).map((file) => ({
      path: path.relative(directory, file),
      bytes: fs.statSync(file).size,
      sha256: sha256(file),
    })),
  };
}

function verifyManifest(directory, manifest) {
  const failures = [];
  for (const entry of manifest.files || []) {
    const file = path.join(directory, entry.path);
    if (!fs.existsSync(file)) {
      failures.push(`${entry.path}: missing`);
      continue;
    }
    const actual = sha256(file);
    if (actual !== entry.sha256) failures.push(`${entry.path}: checksum mismatch`);
  }
  return failures;
}

function usage() {
  console.error("Usage: node scripts/state-backup.js <backup|restore|verify> [directory]");
  process.exit(2);
}

const command = process.argv[2];
if (!command) usage();

if (command === "backup") {
  withLock(lockFile, () => {
    fs.mkdirSync(backupRoot, { recursive: true });
    const backupDir = process.argv[3]
      ? path.resolve(process.argv[3])
      : path.join(backupRoot, `state-${new Date().toISOString().replace(/[T:.Z]/g, "-").replace(/-+$/, "")}`);
    if (fs.existsSync(backupDir)) throw new Error(`Backup destination already exists: ${backupDir}`);
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    copyTree(stateDir, backupDir);
    const manifest = makeManifest(stateDir, stateDir);
    atomicWriteJson(path.join(backupDir, "manifest.json"), manifest);
    console.log(`State backup created: ${path.relative(root, backupDir)}`);
    console.log(`Files: ${manifest.files.length}`);
  });
  process.exit(0);
}

if (command === "verify") {
  const directory = path.resolve(process.argv[3] || "");
  const manifestFile = path.join(directory, "manifest.json");
  if (!directory || !fs.existsSync(manifestFile)) {
    console.error("A backup directory containing manifest.json is required.");
    process.exit(2);
  }
  const failures = verifyManifest(directory, JSON.parse(fs.readFileSync(manifestFile, "utf8")));
  if (failures.length) {
    console.error(`Backup verification failed (${failures.length} issue(s)):`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("Backup verification passed.");
  process.exit(0);
}

if (command === "restore") {
  const backupDir = path.resolve(process.argv[3] || "");
  const manifestFile = path.join(backupDir, "manifest.json");
  if (!backupDir || !fs.existsSync(manifestFile)) {
    console.error("A backup directory containing manifest.json is required.");
    process.exit(2);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const failures = verifyManifest(backupDir, manifest);
  if (failures.length) {
    console.error("Restore refused because the backup failed verification.");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  withLock(lockFile, () => {
    const temporary = `${stateDir}.restore-${process.pid}-${crypto.randomUUID()}`;
    fs.mkdirSync(temporary, { recursive: true, mode: 0o700 });
    copyTree(backupDir, temporary);
    fs.rmSync(path.join(temporary, "manifest.json"), { force: true });
    const previous = `${stateDir}.before-restore-${Date.now()}`;
    if (fs.existsSync(stateDir)) fs.renameSync(stateDir, previous);
    fs.renameSync(temporary, stateDir);
    console.log(`State restored from: ${path.relative(root, backupDir)}`);
    console.log(`Previous state retained at: ${path.relative(root, previous)}`);
  });
  process.exit(0);
}

usage();

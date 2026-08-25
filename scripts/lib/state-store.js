const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function fsyncDirectory(directory) {
  try {
    const descriptor = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (_) {
    // Some platforms do not permit directory fsync. The file rename remains
    // atomic, and callers still receive the completed write.
  }
}

function atomicWriteJson(file, value, options = {}) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.tmp-${process.pid}-${crypto.randomUUID()}`);
  const backup = `${file}.bak`;
  const mode = options.mode || 0o600;
  fs.mkdirSync(directory, { recursive: true });
  const payload = `${JSON.stringify(value, null, 2)}\n`;

  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", mode);
    fs.writeFileSync(descriptor, payload, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (fs.existsSync(file)) fs.copyFileSync(file, backup);
    fs.renameSync(temporary, file);
    fsyncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function readJsonWithRecovery(file) {
  const candidates = [file, `${file}.bak`];
  const errors = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return { value: JSON.parse(fs.readFileSync(candidate, "utf8")), path: candidate, recovered: candidate !== file };
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  const error = new Error(`No valid JSON state found. ${errors.join("; ") || "File is missing."}`);
  error.code = "STATE_UNRECOVERABLE";
  throw error;
}

function acquireLock(lockFile, options = {}) {
  const staleAfterMs = options.staleAfterMs || 30 * 60 * 1000;
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  try {
    const descriptor = fs.openSync(lockFile, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() }));
    fs.closeSync(descriptor);
    return () => fs.rmSync(lockFile, { force: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let stale = false;
    try {
      stale = Date.now() - fs.statSync(lockFile).mtimeMs > staleAfterMs;
    } catch (_) {
      stale = false;
    }
    if (stale && options.removeStale !== false) {
      fs.rmSync(lockFile, { force: true });
      return acquireLock(lockFile, { ...options, removeStale: false });
    }
    const conflict = new Error(`State lock is already held: ${lockFile}`);
    conflict.code = "STATE_LOCKED";
    throw conflict;
  }
}

function withLock(lockFile, callback, options = {}) {
  const release = acquireLock(lockFile, options);
  try {
    return callback();
  } finally {
    release();
  }
}

module.exports = { atomicWriteJson, readJsonWithRecovery, acquireLock, withLock };

#!/usr/bin/env node
'use strict';
// Shared file mutex for governance state (Phase 1A, G-9).
// mkdir(2) is atomic: exactly one contender wins. Stale locks (crashed holder)
// expire via maxAgeMs; the holder's pid is recorded for diagnostics only and
// never trusted for safety (a recycled pid may own nothing).
const fs = require('node:fs');
const path = require('node:path');

function lockPath(targetPath) {
  return `${targetPath}.lock`;
}

// withLock(targetPath, fn, {timeoutMs, maxAgeMs}): run fn() while holding the
// lock for targetPath. Throws on lock timeout. Always releases.
function withLock(targetPath, fn, { timeoutMs = 10000, maxAgeMs = 30000 } = {}) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const lock = lockPath(targetPath);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break; // acquired
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Lock exists: expire it if stale, otherwise wait and retry.
      let age = Infinity;
      try {
        const stat = fs.statSync(lock);
        age = Date.now() - stat.mtimeMs;
      } catch { /* lock vanished; retry immediately */ continue; }
      if (age > maxAgeMs) {
        try { fs.rmdirSync(lock); } catch { /* lost race; retry */ }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`file-lock timeout: ${targetPath} (holder may still be active)`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    try { fs.writeFileSync(path.join(lock, 'pid'), String(process.pid), 'utf8'); } catch { /* diagnostics only */ }
    return fn();
  } finally {
    try { fs.rmSync(lock, { recursive: true, force: true }); } catch { /* best-effort release */ }
  }
}

module.exports = { withLock, lockPath };

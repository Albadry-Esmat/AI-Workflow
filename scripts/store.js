#!/usr/bin/env node
'use strict';
// Phase 3: cross-thread store — flat files under .opencode/state/store/<ns>/<key>.json
// No DB. Atomic write-tmp+rename. Reads allowed cross-thread (shared knowledge).
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function nsDir(ns) { return path.join(ROOT, '.opencode', 'state', 'store', ns); }
function keyPath(ns, key) {
  const safe = String(key).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 128);
  return path.join(nsDir(ns), safe + '.json');
}
function put(ns, key, value) {
  fs.mkdirSync(nsDir(ns), { recursive: true });
  const p = keyPath(ns, key);
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify({ ns, key, value, ts: new Date().toISOString() }, null, 2), 'utf8');
  fs.renameSync(tmp, p);
  return { ns, key };
}
function get(ns, key) {
  const p = keyPath(ns, key);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function list(ns) {
  if (!fs.existsSync(nsDir(ns))) return [];
  return fs.readdirSync(nsDir(ns)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
}
module.exports = { put, get, list };

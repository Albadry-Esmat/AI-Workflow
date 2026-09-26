#!/usr/bin/env node
'use strict';
// Shared identifier sanitizer for governance state paths (Phase 1A, G-9).
// Single implementation: thread ids, store namespaces/keys, case ids must all
// funnel through here so path traversal has exactly one rule to audit.
const path = require('node:path');

function sanitizeId(id, { maxLength = 128 } = {}) {
  const s = String(id == null ? '' : id);
  const safe = s.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, maxLength);
  if (!safe || safe === '.' || safe === '..' || /^_+$/.test(safe) && s !== safe) {
    throw new Error(`unsafe identifier rejected: ${JSON.stringify(s).slice(0, 80)}`);
  }
  if (safe !== s) {
    // Normalized (unsafe chars replaced). Callers that require exact round-trip
    // should reject instead; state paths only need containment + stability.
  }
  return safe;
}

// joinState(root, ...segments): join path segments after sanitizing each one,
// then verify the result stays inside root. Throws on escape.
function joinState(root, ...segments) {
  const clean = segments.map((s) => sanitizeId(s));
  const joined = path.join(root, ...clean);
  const relative = path.relative(root, joined);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('state path escape rejected');
  }
  return joined;
}

module.exports = { sanitizeId, joinState };

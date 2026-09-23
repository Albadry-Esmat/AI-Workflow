#!/usr/bin/env node
'use strict';
// Phase 2: retrieval with A/B flag. Default deterministic (rg + graphify).
// --strategy deterministic (default) | vector-trial (explicit opt-in, reports gap, no behavior change in P2).
const { execFileSync } = require('node:child_process');
function retrieve(query, strategy = 'deterministic') {
  let base;
  try {
    const g = execFileSync('graphify', ['query', query], { encoding: 'utf8', timeout: 15000 });
    base = { method: 'graphify', result: g.slice(0, 2000) };
  } catch {
    try {
      const rg = execFileSync('rg', ['--files', '--max-count', '20'], { encoding: 'utf8', timeout: 15000 });
      base = { method: 'ripgrep', result: rg.slice(0, 2000) };
    } catch { base = { method: 'none', result: '' }; }
  }
  if (strategy === 'vector-trial') return { ...base, trial: 'vector-trial', note: 'trial flag recorded; deterministic result returned (no embeddings in P2)' };
  return base;
}
module.exports = { retrieve };

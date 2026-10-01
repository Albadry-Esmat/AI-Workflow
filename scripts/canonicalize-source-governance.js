#!/usr/bin/env node
'use strict';

// RFC 8785/JCS canonical JSON for source-governance payloads.
// No dependency or filesystem access; callers supply a parsed JSON value.
function canonicalize(value) {
  function visit(v) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new TypeError('JCS rejects non-finite numbers');
      return JSON.stringify(Object.is(v, -0) ? 0 : v);
    }
    if (Array.isArray(v)) return `[${v.map((item) => {
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        throw new TypeError('JCS rejects non-JSON array values');
      }
      return visit(item);
    }).join(',')}]`;
    if (typeof v === 'object') {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new TypeError('JCS accepts only plain objects');
      const keys = Object.keys(v).sort(); // ECMAScript UTF-16 code-unit ordering, as required by JCS.
      return `{${keys.map((key) => {
        const item = v[key];
        if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
          throw new TypeError('JCS rejects non-JSON object values');
        }
        return `${JSON.stringify(key)}:${visit(item)}`;
      }).join(',')}}`;
    }
    throw new TypeError('JCS rejects non-JSON values');
  }
  return visit(value);
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      process.stdout.write(canonicalize(JSON.parse(raw)));
    } catch (error) {
      process.stderr.write(`canonicalize-source-governance: ${error.message}\n`);
      process.exitCode = 1;
    }
  });
}

module.exports = { canonicalize };

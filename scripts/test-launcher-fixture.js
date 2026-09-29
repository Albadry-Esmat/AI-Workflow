#!/usr/bin/env node
'use strict';

// Test-only fixture issuer.  It is intentionally separate from production
// launchers and enables the callsite-bound capability only inside test runs.
process.env.AIW_TEST_FIXTURE = '1';
const identity = require('./execution-identity');

module.exports = {
  launcher(params) {
    return identity.createLauncherDispatchIdentity(params);
  },
  worker(params) {
    return identity.createWorkerDispatchIdentity(params);
  },
};

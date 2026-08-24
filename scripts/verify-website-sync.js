#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const result = spawnSync("bash", [path.join(root, "scripts", "sync-website-data.sh"), "--check"], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) {
  console.error(`WEBSITE_SYNC_GUARD_ERROR: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error("WEBSITE_SYNC_GUARD_FAILED: authoritative sources and website/data are not synchronized");
  console.error("Run `aiw sync`, review the generated diff, and commit source plus website/data together.");
  process.exit(result.status || 1);
}
console.log("WEBSITE_SYNC_GUARD_PASSED: website/data matches the authoritative manifest.");

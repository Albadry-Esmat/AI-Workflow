#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const filePath = path.resolve(__dirname, "..", "skills", "index.yaml");
try {
  yaml.load(fs.readFileSync(filePath, "utf8"));
  console.log(`  PASS: ${path.relative(process.cwd(), filePath)} parses as valid YAML`);
} catch (error) {
  console.error(`  FAIL: ${path.relative(process.cwd(), filePath)} YAML parse error: ${error.message}`);
  process.exit(1);
}

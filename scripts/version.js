#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const compatibility = JSON.parse(fs.readFileSync(path.join(root, "compatibility.json"), "utf8"));

const output = {
  cli_version: packageJson.version,
  framework_version: compatibility.framework_version,
  manifest_version: compatibility.manifest_version,
  schema_version: compatibility.schema_version,
  runtime: compatibility.runtime,
  external_cli: compatibility.external_cli,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} else {
  process.stdout.write(`aiw v${output.cli_version} (AI Workflow CLI)\n`);
  process.stdout.write(`framework ${output.framework_version}; schema ${output.schema_version}; Node ${output.runtime.node}; Python ${output.runtime.python}\n`);
}

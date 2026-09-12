#!/usr/bin/env node
/**
 * Minimal project-local JSON Schema validator for O1.
 * Usage: validate-json-schema.mjs validate -s schema.json -d data.json [--spec=draft7]
 */
import fs from "node:fs";
import process from "node:process";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const args = process.argv.slice(2);
if (args[0] !== "validate") {
  console.error("usage: validate-json-schema.mjs validate -s schema.json -d data.json");
  process.exit(2);
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) return null;
  return args[index + 1];
}

const schemaPath = valueAfter("-s") ?? valueAfter("--schema");
const dataPath = valueAfter("-d") ?? valueAfter("--data");
if (!schemaPath || !dataPath) {
  console.error("schema (-s) and data (-d) are required");
  process.exit(2);
}

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const valid = ajv.validate(schema, data);
  if (!valid) {
    for (const error of ajv.errors ?? []) console.error(`${error.instancePath || "/"} ${error.message}`);
    process.exit(1);
  }
  console.log(`${dataPath} valid`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

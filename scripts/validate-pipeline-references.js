#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const skillRoot = path.join(ROOT, ".opencode", "skills");
const pipelineRoot = path.join(ROOT, "skills", "pipelines");
const sourceSkills = new Set(
  fs.readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name),
);

const references = [];
const errors = [];

function addSkillReference(pipeline, phase, skill) {
  if (!skill || typeof skill.name !== "string") {
    errors.push(`${pipeline}:${phase} has a skill entry without a string name`);
    return;
  }
  const name = skill.name.split("@")[0];
  references.push({ pipeline, phase, name });
  if (!sourceSkills.has(name)) errors.push(`${pipeline}:${phase} references unknown skill: ${skill.name}`);
}

for (const filename of fs.readdirSync(pipelineRoot).filter((file) => file.endsWith(".json")).sort()) {
  const pipelinePath = path.join(pipelineRoot, filename);
  let pipeline;
  try {
    pipeline = JSON.parse(fs.readFileSync(pipelinePath, "utf8"));
  } catch (error) {
    errors.push(`${filename} is invalid JSON: ${error.message}`);
    continue;
  }

  if (Array.isArray(pipeline.phases)) {
    for (const phase of pipeline.phases) {
      if (!phase || typeof phase.id !== "string" || !Array.isArray(phase.skills)) {
        errors.push(`${filename} contains a malformed phase`);
        continue;
      }
      for (const skill of phase.skills) addSkillReference(filename, phase.id, skill);
    }
  } else if (Array.isArray(pipeline.skills)) {
    for (const skill of pipeline.skills) addSkillReference(filename, "main", skill);
  } else {
    errors.push(`${filename} has neither phases nor skills`);
  }
}

const uniqueReferences = new Set(references.map((reference) => reference.name));
console.log(`Pipeline reference validation: ${errors.length === 0 ? "PASS" : "FAIL"}`);
console.log(`  pipelines=${fs.readdirSync(pipelineRoot).filter((file) => file.endsWith(".json")).length} references=${references.length} uniqueSkills=${uniqueReferences.size} sourceSkills=${sourceSkills.size}`);
for (const error of errors) console.log(`  FAIL: ${error}`);
if (errors.length > 0) process.exit(1);

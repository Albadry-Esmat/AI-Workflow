#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "website-data-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!manifest || manifest.version !== "1.0.0") {
  throw new Error("Unsupported website data manifest version");
}

const files = Array.isArray(manifest.files) ? manifest.files : [];
const directories = Array.isArray(manifest.directories) ? manifest.directories : [];
const seenDestinations = new Set();

function validateEntry(entry, kind) {
  if (!entry || typeof entry.source !== "string" || typeof entry.destination !== "string") {
    throw new Error(`Invalid ${kind} entry: source and destination are required`);
  }
  if (path.isAbsolute(entry.source) || path.isAbsolute(entry.destination)) {
    throw new Error(`Manifest paths must be relative: ${entry.source}`);
  }
  if (entry.source.split(path.sep).includes("..") || entry.destination.split(path.sep).includes("..")) {
    throw new Error(`Manifest paths cannot escape the repository: ${entry.source}`);
  }
  if (kind === "directory" && typeof entry.pattern !== "string") {
    throw new Error(`Directory entry requires a pattern: ${entry.source}`);
  }
  const key = `${kind}:${entry.destination}:${entry.pattern || ""}`;
  if (seenDestinations.has(key)) {
    throw new Error(`Duplicate manifest entry: ${key}`);
  }
  seenDestinations.add(key);
}

for (const entry of files) validateEntry(entry, "file");
for (const entry of directories) validateEntry(entry, "directory");

for (const entry of files) {
  process.stdout.write(`file\t${entry.source}\t${entry.destination}\n`);
}
for (const entry of directories) {
  process.stdout.write(`directory\t${entry.source}\t${entry.destination}\t${entry.pattern}\n`);
}

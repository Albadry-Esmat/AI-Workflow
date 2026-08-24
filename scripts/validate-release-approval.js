#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const file = path.resolve(process.env.AIW_RELEASE_APPROVAL || process.argv[2] || path.join(root, "tests/fixtures/release-approval.json"));
const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => { failures.push(message); console.error(`FAIL ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };

function isIsoDate(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function isRef(value) { return typeof value === "string" && /^[A-Za-z0-9._/-]{1,200}$/.test(value); }
function collectKeys(value, prefix = "", output = []) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    output.push(full);
    collectKeys(child, full, output);
  }
  return output;
}

let record;
try {
  record = JSON.parse(fs.readFileSync(file, "utf8"));
  pass(`release approval record parses: ${path.relative(root, file)}`);
} catch (error) {
  fail(`release approval record cannot be read: ${error.message}`);
}

if (record) {
  check(record.approval_version === "1.0.0", "approval_version must be 1.0.0");
  check(typeof record.release_id === "string" && /^[a-z0-9][a-z0-9._-]{2,120}$/.test(record.release_id), "release_id is invalid");
  check(record.source_commit === "repository-fixture" || (typeof record.source_commit === "string" && /^[A-Fa-f0-9]{7,64}$/.test(record.source_commit)), "source_commit is invalid");
  check(typeof record.branch === "string" && record.branch.length > 0 && record.branch.length <= 160, "branch is required");
  check(["no-go", "conditional-go", "go"].includes(record.decision), "decision is invalid");
  check(["repository-side", "internal-pilot", "general-production"].includes(record.decision_scope), "decision_scope is invalid");
  check(isIsoDate(record.issued_at), "issued_at must be an ISO-8601 date-time");
  check(typeof record.release_owner === "string" && record.release_owner.length > 0 && record.release_owner.length <= 120, "release_owner is required");
  check(typeof record.independent_reviewer === "string" && record.independent_reviewer.length > 0 && record.independent_reviewer.length <= 120, "independent_reviewer is required");
  check(record.sanitized === true, "sanitized must be true");

  const blockers = Array.isArray(record.blockers) ? record.blockers : [];
  const blockerIds = new Set();
  for (const blocker of blockers) {
    check(blocker && typeof blocker.id === "string" && /^[A-Za-z0-9._-]{2,80}$/.test(blocker.id), "blocker id is invalid");
    if (blocker?.id) check(!blockerIds.has(blocker.id), `duplicate blocker: ${blocker.id}`);
    if (blocker?.id) blockerIds.add(blocker.id);
    check(["P0", "P1", "P2", "P3"].includes(blocker?.priority), `invalid blocker priority: ${blocker?.id || "unknown"}`);
    check(["open", "resolved", "accepted"].includes(blocker?.status), `invalid blocker status: ${blocker?.id || "unknown"}`);
    check(typeof blocker?.owner === "string" && blocker.owner.length > 0 && blocker.owner.length <= 120, `blocker owner is required: ${blocker?.id || "unknown"}`);
    check(isRef(blocker?.evidence_ref), `blocker evidence_ref is invalid: ${blocker?.id || "unknown"}`);
  }

  const evidence = record.evidence || {};
  check(["pass", "fail"].includes(evidence.repository_checks), "evidence.repository_checks is invalid");
  check(["repository-fixtures-only", "operator-verified", "pilot-certified", "blocked", "not-run"].includes(evidence.runtime_certification_state), "evidence.runtime_certification_state is invalid");
  check(["pass", "blocked", "not-run"].includes(evidence.live_runtime_state), "evidence.live_runtime_state is invalid");
  check(["pass", "pending", "fail"].includes(evidence.independent_review_status), "evidence.independent_review_status is invalid");
  check(["pass", "pending", "fail"].includes(evidence.rollback_review_status), "evidence.rollback_review_status is invalid");
  if (evidence.report_ref !== undefined) check(isRef(evidence.report_ref), "evidence.report_ref is invalid");

  const sync = record.documentation_sync || {};
  check(sync.policy === "pass", "documentation_sync.policy must be pass");
  check(sync.website === "pass", "documentation_sync.website must be pass");

  const openHigh = blockers.filter((item) => item.status === "open" && ["P0", "P1"].includes(item.priority));
  const pendingOwner = /pending|unassigned|unknown/i.test(`${record.release_owner} ${record.independent_reviewer}`);
  const fixtureEvidence = record.source_commit === "repository-fixture" || record.fixture === true || evidence.runtime_certification_state === "repository-fixtures-only";

  if (record.decision_scope === "repository-side") check(record.decision === "no-go", "repository-side approval must be no-go");
  if (record.decision === "conditional-go") {
    check(record.decision_scope === "internal-pilot", "conditional-go is limited to internal-pilot scope");
    check(!openHigh.length, "conditional-go cannot have open P0/P1 blockers");
    check(evidence.repository_checks === "pass", "conditional-go requires repository checks to pass");
    check(evidence.live_runtime_state === "pass", "conditional-go requires live runtime state pass");
    check(evidence.runtime_certification_state === "operator-verified" || evidence.runtime_certification_state === "pilot-certified", "conditional-go requires operator-verified or pilot-certified evidence");
    check(!fixtureEvidence, "fixture evidence cannot support conditional-go");
    check(!pendingOwner, "conditional-go requires assigned release owner and independent reviewer");
  }
  if (record.decision === "go") {
    check(record.decision_scope === "general-production", "go is limited to general-production scope");
    check(!openHigh.length, "go cannot have open P0/P1 blockers");
    check(blockers.every((item) => item.status !== "open"), "go cannot have open blockers");
    check(evidence.repository_checks === "pass", "go requires repository checks to pass");
    check(evidence.live_runtime_state === "pass", "go requires live runtime state pass");
    check(evidence.runtime_certification_state === "pilot-certified", "go requires pilot-certified evidence");
    check(evidence.independent_review_status === "pass", "go requires independent review pass");
    check(evidence.rollback_review_status === "pass", "go requires rollback review pass");
    check(!fixtureEvidence, "fixture evidence cannot support go");
    check(record.source_commit !== "repository-fixture", "go cannot use repository-fixture source commit");
    check(!pendingOwner, "go requires assigned release owner and independent reviewer");
  }

  const serialized = JSON.stringify(record);
  const prohibitedKeys = collectKeys(record).filter((key) => /prompt|payload|token|authorization|password|personal.?data|session.?json|secret/i.test(key));
  check(prohibitedKeys.length === 0, `record contains prohibited sensitive-data field(s): ${prohibitedKeys.join(", ")}`);
  check(!/Bearer\s+(?!\[REDACTED\])|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]|sk-[A-Za-z0-9]/i.test(serialized), "record contains a credential-like value");
  pass("release approval record is sanitized and scope decision is consistent");
}

if (failures.length) {
  console.error(`Release approval validation failed (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log("Release approval validation passed.");

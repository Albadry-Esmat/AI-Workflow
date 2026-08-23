const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { atomicWriteJson, readJsonWithRecovery, withLock } = require("./state-store");

function operationKey(operation, material) {
  return `${operation}:${crypto.createHash("sha256").update(String(material)).digest("hex")}`;
}
function ledgerPath(file) { return path.resolve(file || process.env.AIW_IDEMPOTENCY_FILE || path.resolve(__dirname, "../../.opencode/state/idempotency.json")); }
function emptyLedger() { return { schema_version: "1.0.0", operations: {} }; }
function load(file) {
  const target = ledgerPath(file);
  if (!fs.existsSync(target)) return emptyLedger();
  try { return readJsonWithRecovery(target).value; }
  catch (_) { return emptyLedger(); }
}
function inspect(key, file) { return load(file).operations?.[key] || null; }
function record(key, value, file) {
  const target = ledgerPath(file);
  withLock(`${target}.lock`, () => {
    const ledger = load(target);
    ledger.schema_version = "1.0.0";
    ledger.operations = ledger.operations || {};
    ledger.operations[key] = { status: value.status, recorded_at: new Date().toISOString(), result_category: String(value.result_category || "unspecified").slice(0, 120) };
    atomicWriteJson(target, ledger);
  });
  return ledgerPath(target);
}
function claim(key, file) {
  const target = ledgerPath(file);
  let result;
  withLock(`${target}.lock`, () => {
    const ledger = load(target);
    const existing = ledger.operations?.[key];
    if (existing) {
      result = { duplicate: true, existing };
      return;
    }
    ledger.schema_version = "1.0.0";
    ledger.operations = ledger.operations || {};
    ledger.operations[key] = { status: "claimed", recorded_at: new Date().toISOString(), result_category: "pending" };
    atomicWriteJson(target, ledger);
    result = { duplicate: false };
  });
  return result;
}
module.exports = { operationKey, ledgerPath, load, inspect, record, claim };

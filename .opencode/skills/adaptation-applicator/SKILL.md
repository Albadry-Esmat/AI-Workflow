---
name: adaptation-applicator
version: 1.0.0
domain: system
description: 'Use when applying a HITL-approved AdaptationProposal to the system. Triggers on: "apply this proposal", "implement the approved change", "adapt the system", "apply adaptation". REQUIRES hitl_status == "approved" on the input proposal — rejects any proposal with hitl_status != "approved". Creates a rollback checkpoint before every change. Runs validate-skills.sh and npm run build after every change.'
author: ASE-OS
---

# Adaptation Applicator

**Version:** 1.0.0 | **Last updated:** 2026-06-20

Applies a single HITL-approved `AdaptationProposal` (from `adaptive-proposal-generator`, SKL-050) to the live system. Supports five change types: `new_skill`, `modify_skill`, `retire_skill`, `new_pipeline`, and `new_agent`. Creates a rollback checkpoint before every write, runs `validate-skills.sh` and `npm run build` after every change, and triggers `doc-maintainer` (SKL-011) to keep documentation in sync.

---

## 1. Skill Header

```yaml
name: adaptation-applicator
version: 1.0.0
domain: system
description: >
  Applies a single HITL-approved AdaptationProposal to the skill system.
  Enforces hitl_status == "approved" as first and unconditional check.
  Creates rollback checkpoint before any write. Runs validate-skills.sh
  and npm run build after every change. Triggers doc-maintainer on success.
author: ASE-OS
```

---

## 2. Purpose

`adaptation-applicator` is the execution layer of the Phase 3 Assisted Adaptation system. It receives a single approved proposal from the HITL gate and applies the described change with full safety guarantees:

```
⚠️  HITL Gate — user approves proposal
         ↓  approved_proposal (hitl_status == "approved")
adaptation-applicator (SKL-051)   ← this skill
         ↓  (on success)
    [rollback checkpoint created]
    [change applied]
    [validate-skills.sh: 0 failures]
    [npm run build: 0 errors]
    [doc-maintainer triggered]
         ↓
    applied_changes[] + validation_result
```

**Five change handlers:**

| `proposal.type` | What gets written | Validation |
|----------------|-------------------|------------|
| `new_skill` | New SKILL.md in `.opencode/skills/<name>/` + registry + index + graph | validate-skills.sh + build |
| `modify_skill` | Updated SKILL.md + version bump in registry + index + graph | validate-skills.sh + build |
| `retire_skill` | `status: deprecated` in registry + deprecation notice in SKILL.md | validate-skills.sh + build |
| `new_pipeline` | New JSON in `skills/pipelines/<name>.json` | validate-skills.sh + build |
| `new_agent` | New `.opencode/agent/<name>.md` + opencode.json update | validate-skills.sh + build |

**Non-negotiable safety rules:**
1. HITL approval check is the **first and unconditional** step — no proposal proceeds without `hitl_status == "approved"`.
2. Rollback checkpoint is created **before any write** — not after.
3. If any validation step fails (validate-skills.sh or build), the rollback is executed automatically and the failure is reported without user prompt.
4. `dry_run: true` simulates all steps and returns a diff without writing any file.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `approved_proposal` | `AdaptationProposal` | Yes | Single proposal with `hitl_status == "approved"` from SKL-050 + orchestrator |
| `session_id` | `string` | Yes | UUID v4 of the current session (for rollback checkpoint naming) |
| `dry_run` | `boolean` | No | If true, simulate all changes and return a diff without writing (default: false) |
| `build_website` | `boolean` | No | If false, skip `npm run build` (default: true — always build) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["approved_proposal", "session_id"],
  "additionalProperties": false,
  "properties": {
    "approved_proposal": {
      "type": "object",
      "required": ["id", "type", "title", "change_description", "hitl_status"],
      "properties": {
        "id":               { "type": "string" },
        "type":             { "type": "string", "enum": ["new_skill", "modify_skill", "retire_skill", "new_pipeline", "new_agent"] },
        "title":            { "type": "string" },
        "change_description": { "type": "string" },
        "hitl_status":      { "type": "string", "enum": ["approved"] },
        "evidence":         { "type": "object" }
      }
    },
    "session_id": { "type": "string", "format": "uuid" },
    "dry_run":       { "type": "boolean", "default": false },
    "build_website": { "type": "boolean", "default": true }
  }
}
```

---

## 4. Required Context

- Must have write access to `.opencode/skills/`, `skills/registry.json`, `skills/index.yaml`, `skills/graph/skill-graph.yaml`, `skills/pipelines/`, `.opencode/agent/`, `opencode.json`.
- `validate-skills.sh` must be executable from project root (`bash scripts/validate-skills.sh`).
- `npm run build` must be runnable from `website/` directory.
- Read `skills/registry.json` and `skills/index.yaml` to determine next available SKL-NNN before registering a new skill.
- Read `skills/graph/skill-graph.yaml` to determine current `total_nodes` and `total_edges` before adding graph entries.
- This skill operates on live files — always create rollback checkpoint first.

---

## 5. Execution Logic

```
Step 1 — HITL approval check (UNCONDITIONAL FIRST STEP)
  IF approved_proposal.hitl_status != "approved":
    HALT immediately.
    Return: { success: false, error: "HITL_APPROVAL_REQUIRED",
              message: "Proposal must have hitl_status == 'approved' before adaptation-applicator may proceed." }
  Log: "HITL approval confirmed for proposal " + approved_proposal.id

Step 2 — dry_run short-circuit
  IF dry_run == true:
    Simulate all steps below.
    Return: { success: true, dry_run: true, simulated_changes: [...], validation_result: "simulated" }

Step 3 — Create rollback checkpoint
  checkpoint = {
    id:          "ckpt-" + session_id + "-" + timestamp(),
    created_at:  ISO8601 timestamp,
    files: {
      "skills/registry.json":           fs.read("skills/registry.json"),
      "skills/index.yaml":              fs.read("skills/index.yaml"),
      "skills/graph/skill-graph.yaml":  fs.read("skills/graph/skill-graph.yaml"),
      "opencode.json":                  fs.read("opencode.json")
    }
  }
  Write checkpoint to state-manager scope "rollback_log".
  Log: "Rollback checkpoint created: " + checkpoint.id

Step 4 — Route to change handler
  SWITCH approved_proposal.type:

    CASE "new_skill":
      → Execute HANDLER_NEW_SKILL (see below)

    CASE "modify_skill":
      → Execute HANDLER_MODIFY_SKILL (see below)

    CASE "retire_skill":
      → Execute HANDLER_RETIRE_SKILL (see below)

    CASE "new_pipeline":
      → Execute HANDLER_NEW_PIPELINE (see below)

    CASE "new_agent":
      → Execute HANDLER_NEW_AGENT (see below)

Step 5 — Run validate-skills.sh
  result = exec("bash scripts/validate-skills.sh")
  IF result.exit_code != 0:
    Log: "validate-skills.sh FAILED — initiating rollback"
    → Execute ROLLBACK(checkpoint)
    Return: { success: false, error: "VALIDATION_FAILED", validation_output: result.output,
              rollback_executed: true, checkpoint_id: checkpoint.id }
  Log: "validate-skills.sh: all checks passed"

Step 6 — Run npm run build (if build_website == true)
  result = exec("npm run build", cwd: "website/")
  IF result.exit_code != 0:
    Log: "npm run build FAILED — initiating rollback"
    → Execute ROLLBACK(checkpoint)
    Return: { success: false, error: "BUILD_FAILED", build_output: result.output,
              rollback_executed: true, checkpoint_id: checkpoint.id }
  Log: "npm run build: 0 errors"

Step 7 — Trigger doc-maintainer (SKL-011)
  Emit change_event to doc-maintainer:
    { change_type: "skill_system_update", proposal_id: approved_proposal.id,
      proposal_type: approved_proposal.type, target: applied_target }
  NOTE: doc-maintainer runs async — this step does not block.

Step 8 — Return success
  Return: {
    success: true,
    proposal_id:       approved_proposal.id,
    proposal_type:     approved_proposal.type,
    applied_changes:   [...],
    validation_result: "passed",
    checkpoint_id:     checkpoint.id,
    docs_update:       "triggered",
    metrics:           standard execution metrics,
    feedback:          []
  }

─────────────────────────────────────────────────────────────
HANDLER_NEW_SKILL:
  1. Derive skill_name from proposal.evidence.target_skill or
     from proposal.change_description (ask orchestrator if unclear).
  2. Determine next SKL-NNN:
       last_id = max(registry.skills[].id where id matches /SKL-\d+/)
       new_id = "SKL-" + zero_pad(last_id_number + 1, 3)
  3. Invoke skill-authoring (SKL-012) to draft SKILL.md content
     using proposal.change_description as the specification.
  4. Write: .opencode/skills/<skill_name>/SKILL.md
  5. Append to skills/registry.json:
       { "name": skill_name, "version": "1.0.0", "status": "active",
         "domain": <derived>, "path": ".opencode/skills/<skill_name>/SKILL.md", ... }
  6. Append to skills/index.yaml:
       id, name, short_description, reference_path, executable_skill, tags, version, depends_on, mastery_level, use_when, do_not_use_when
  7. Append to skills/graph/skill-graph.yaml:
       node: { id: new_id, name: skill_name, version: "1.0.0", ... }
       edges: dependency edges derived from depends_on list
  8. Bump skills/index.yaml meta.version (PATCH)
  9. Bump skills/graph/skill-graph.yaml meta.total_nodes += 1, total_edges += new_edge_count
  10. applied_changes = ["new SKILL.md", "registry entry", "index entry", "graph node + edges"]

HANDLER_MODIFY_SKILL:
  1. Locate skill in registry by name (proposal.evidence.target_skill).
  2. Read current SKILL.md.
  3. Apply change_description — add/update the relevant sections (quality checklist,
     execution steps, examples, HITL gate config).
  4. Bump skill version (PATCH for checklist/examples, MINOR for new steps).
  5. Update version in registry.json, index.yaml, skill-graph.yaml node.
  6. applied_changes = ["SKILL.md updated", "version bumped in registry/index/graph"]

HANDLER_RETIRE_SKILL:
  1. Locate skill in registry by name (proposal.evidence.target_skill).
  2. Set registry entry: { "status": "deprecated", "deprecated_at": ISO8601, "replaced_by": replacement ?? null }
  3. Prepend deprecation notice to SKILL.md:
       > ⚠️ DEPRECATED as of <date>. Replaced by: <replacement or "no replacement">. Reason: <rationale>.
  4. Update skills/index.yaml entry: add `status: deprecated` field.
  5. applied_changes = ["status: deprecated in registry", "deprecation notice added to SKILL.md", "index updated"]

HANDLER_NEW_PIPELINE:
  1. Derive pipeline_name from proposal.change_description or evidence.skills_in_sequence.
  2. Generate skills/pipelines/<pipeline_name>.json with phases derived from sequence.
  3. Each skill in sequence becomes a phase. Add standard gates (architecture approval, security, deployment).
  4. Validate against skills/schema/pipeline-schema.json.
  5. applied_changes = ["new pipeline JSON: skills/pipelines/<name>.json"]

HANDLER_NEW_AGENT:
  1. Derive agent_name and assigned_skill from proposal.change_description.
  2. Generate .opencode/agent/<agent_name>.md instruction file.
  3. Append to opencode.json agent map:
       { "mode": "subagent", "model": "github-copilot/claude-sonnet-4.6",
         "permission": { "edit": "ask", "bash": "deny" },
         "description": "<derived from proposal>" }
  4. applied_changes = ["new .opencode/agent/<name>.md", "opencode.json updated"]

─────────────────────────────────────────────────────────────
ROLLBACK procedure:
  FOR each file in checkpoint.files:
    fs.write(file.path, file.content)
  Log: "Rollback complete — all files restored to checkpoint " + checkpoint.id
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | True if all steps completed and validation passed |
| `proposal_id` | `string` | ID of the applied proposal |
| `proposal_type` | `string` | Type of change applied |
| `applied_changes` | `array[string]` | Human-readable list of files written/modified |
| `validation_result` | `string` | `passed`, `failed`, or `simulated` |
| `rollback_executed` | `boolean` | True if a rollback was performed (only on failure) |
| `checkpoint_id` | `string` | ID of the rollback checkpoint created |
| `dry_run` | `boolean` | True if this was a dry run |
| `simulated_changes` | `array[string]` | Dry-run only — list of changes that would be applied |
| `docs_update` | `string` | `triggered` if doc-maintainer was fired, `skipped` on failure |
| `error` | `string` | Error code if success == false |
| `metrics` | `object` | Standard execution metrics |
| `feedback` | `array[object]` | Feedback to orchestrator |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["success", "metrics", "feedback"],
  "additionalProperties": false,
  "properties": {
    "success":           { "type": "boolean" },
    "dry_run":           { "type": "boolean" },
    "proposal_id":       { "type": "string" },
    "proposal_type":     { "type": "string" },
    "applied_changes":   { "type": "array", "items": { "type": "string" } },
    "simulated_changes": { "type": "array", "items": { "type": "string" } },
    "validation_result": { "type": "string", "enum": ["passed", "failed", "simulated"] },
    "rollback_executed": { "type": "boolean" },
    "checkpoint_id":     { "type": "string" },
    "docs_update":       { "type": "string", "enum": ["triggered", "skipped"] },
    "error":             { "type": "string" },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Rules & Constraints

- **HITL approval is mandatory and checked first** — any proposal with `hitl_status != "approved"` is rejected immediately with `HITL_APPROVAL_REQUIRED`. No exceptions.
- **Rollback checkpoint is created before any write** — never after. If checkpoint creation fails, abort with error.
- **One proposal per invocation** — do not batch multiple proposals. Invoke this skill once per approved proposal.
- If `validate-skills.sh` fails after a change, rollback is automatic and unconditional.
- If `npm run build` fails after a change, rollback is automatic and unconditional.
- `dry_run: true` is always safe to invoke — it never writes files.
- `new_skill` handler MUST invoke skill-authoring (SKL-012) — never generate SKILL.md content directly without the skill-authoring framework.
- `new_pipeline` JSON must be validated against `skills/schema/pipeline-schema.json` before writing.
- All registry, index, and graph bumps must be atomic within a single invocation — partial updates are not acceptable.
- This skill MUST emit a change event to doc-maintainer (SKL-011) on every successful application.
- After applying a `new_skill` or `modify_skill`, increment `skills/graph/skill-graph.yaml` `meta.total_nodes` or `meta.total_edges` accurately.

---

## 8. Security Considerations

- **HITL approval check as invariant** — the `hitl_status == "approved"` check is hardcoded as Step 1 and cannot be bypassed by orchestrator configuration.
- Rollback checkpoint stores only file contents — no credentials, secrets, or user data.
- `HANDLER_NEW_SKILL` delegates to skill-authoring (SKL-012) — adaptation-applicator does not generate arbitrary code or file content directly.
- `HANDLER_NEW_PIPELINE` validates generated JSON against the pipeline schema before writing — no schema-invalid pipelines can be deployed.
- `HANDLER_NEW_AGENT` uses a fixed permission template (`edit: ask`, `bash: deny`) — no new agent can be granted more than editor-level permissions.
- opencode.json updates append only — no existing agent entries are modified or removed.
- Write access is limited to skill system files — adaptation-applicator cannot write to `docs/governance.md`, pipeline gate configurations, or guard skill SKILL.md files.

---

## 9. Token Optimization

- Operates on structured JSON (proposal + registry) — compact inputs.
- File writes are targeted (one to three files per change type) — minimal I/O.
- `dry_run` mode is zero-cost for disk I/O — safe to invoke for change previews.
- `validate-skills.sh` and `npm run build` are external processes — do not consume LLM tokens.
- Rollback checkpoint stores full file contents — may be 5–50 KB depending on registry size; stored in session state, not in LLM context.

---

## 10. Quality Checklist

- [ ] HITL approval check is first and unconditional — no proposal proceeds without `hitl_status == "approved"`
- [ ] Rollback checkpoint created before any write — confirmed in execution log
- [ ] `validate-skills.sh` passes after every change
- [ ] `npm run build` returns 0 errors after every change
- [ ] `applied_changes[]` lists all files actually written
- [ ] `meta.total_nodes` and `meta.total_edges` updated correctly in graph YAML after new_skill
- [ ] doc-maintainer triggered with change_event on success
- [ ] `dry_run` returns `simulated_changes` without writing any file
- [ ] Rollback restores all checkpoint files on validation failure
- [ ] `new_pipeline` JSON validated against pipeline schema before write
- [ ] `new_agent` uses fixed permission template — no escalated permissions
- [ ] Standard `metrics` and `feedback` fields present in all outputs

---

## 11. Failure Scenarios

| Condition | Behavior |
|-----------|----------|
| `hitl_status != "approved"` | Halt immediately — `HITL_APPROVAL_REQUIRED` error; no file written |
| Checkpoint creation fails (disk error) | Abort — `CHECKPOINT_FAILED` error; no change applied |
| `new_skill` handler: skill-authoring (SKL-012) fails | Rollback checkpoint (none yet modified) — return `SKILL_AUTHORING_FAILED` |
| validate-skills.sh fails after write | Auto-rollback from checkpoint — return `VALIDATION_FAILED` with full output |
| npm run build fails after validate passes | Auto-rollback from checkpoint — return `BUILD_FAILED` with build output |
| doc-maintainer unavailable | Log warning; return `docs_update: "skipped"` — not a blocking failure |
| Unknown `proposal.type` | Halt — `UNSUPPORTED_PROPOSAL_TYPE` error; no change applied |
| Registry / index / graph file unreadable | Abort — `FILE_READ_ERROR`; no change applied |

---

## 12. Human-in-the-Loop Gates

This skill enforces a mandatory HITL gate at entry (Step 1). The gate is defined by the **orchestrator** presenting the proposal to the user, not by this skill directly.

| Gate | Trigger | Behavior |
|------|---------|----------|
| `adaptation_apply` | `approved_proposal.hitl_status == "approved"` (orchestrator-set) | This skill proceeds if and only if the orchestrator has set `hitl_status: "approved"` on the proposal. Any other value halts immediately. |

**Downstream HITL note:** If `new_skill` produces a new SKILL.md, the resulting skill is registered as `status: active` but will not appear in pipeline routing until the orchestrator is updated. A subsequent HITL gate in the routing-update flow is recommended before the new skill is invoked in production pipelines.

---

## 13. Skill Composition

`adaptation-applicator` is invoked by the orchestrator only after a HITL gate has approved a proposal from `adaptive-proposal-generator` (SKL-050).

```yaml
# Invocation pattern (conceptual)
name: adaptation-applicator-invocation
trigger: after adaptation_review HITL gate resolves with at least one approved proposal
async: false  # blocking — waits for validation to complete
input_map:
  approved_proposal:  "hitl_gate.adaptation_review.approved_proposals[0]"
  session_id:         "session_context.session_id"
  dry_run:            false
  build_website:      true

consumes_from:
  - adaptive-proposal-generator (SKL-050)  # proposals originate here
  - skill-authoring (SKL-012)              # invoked for new_skill proposals

produces_for:
  - doc-maintainer (SKL-011)               # receives change event on success
```

### Example Applied Change Log

```
[2026-06-20T14:45:00Z] HITL approval confirmed for PROP-a1b2c3 (modify_skill)
[2026-06-20T14:45:00Z] Rollback checkpoint created: ckpt-session-abc123-20260620T144500
[2026-06-20T14:45:01Z] Updating .opencode/skills/architecture-design/SKILL.md — adding 2 worked examples
[2026-06-20T14:45:01Z] Bumping architecture-design version 1.2.0 → 1.2.1 in registry, index, graph
[2026-06-20T14:45:02Z] Running validate-skills.sh... 71 passed, 0 failed ✅
[2026-06-20T14:45:08Z] Running npm run build... 64 static pages, 0 errors ✅
[2026-06-20T14:45:08Z] Triggering doc-maintainer with change event
[2026-06-20T14:45:08Z] SUCCESS — adaptation applied and validated
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-20 | Initial version — HITL-gated application engine; 5 change handlers (new_skill, modify_skill, retire_skill, new_pipeline, new_agent); rollback checkpoint; validate-skills.sh + npm run build validation; doc-maintainer integration |

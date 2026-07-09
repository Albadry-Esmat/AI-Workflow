# ADR-0002 — Work Item Export Contract

**Status:** Accepted  
**Date:** 2026-06-22  
**Deciders:** ASE-OS pipeline (Phase 1 Work Lifecycle Management Layer)  
**Skills involved:** `work-item-exporter` (SKL-057)  
**Related docs:** `docs/work-item-foundation.md`, `docs/skills-registry.md §SKL-057`, `ADR-0001`

---

## Context

Work items created by the pipeline need to be consumable by external project management platforms (primarily Jira) and human operators. An export contract — defining the output format, directionality, PII handling, and FEATURE type mapping — was required before `work-item-exporter` could be implemented.

### Forces at play

1. **Jira is the dominant external platform** — the primary consumer of exported work items is Atlassian Jira (Cloud and Server/Data Center). All export decisions are evaluated first against Jira compatibility.

2. **Export must never block the pipeline** — work item export is a non-core, final-step operation. A slow Jira API, a network timeout, or a format mismatch must not halt earlier pipeline stages.

3. **PII risk** — work item bodies may contain developer names, email addresses, internal URLs, and customer-identifying information captured during requirement analysis. These must not leak into exported files stored outside the secure pipeline context.

4. **Format variety** — different operators need different output formats: Jira for ticket creation, JSON Lines for programmatic processing, Markdown for human review. A single rigid output format would not serve all operators.

5. **FEATURE items are architecturally different** — `FEATURE` items use a folder structure (not a flat file) and represent multi-task epics. Jira Epics are the natural mapping; handling this consistently eliminates manual field mapping by operators.

6. **Bidirectional sync adds HITL complexity** — pulling Jira status back into local work items risks overwriting locally-valid states. Any sync must be human-approved, never automatic.

---

## Decision

### 1. Primary output format: Jira Bulk Import JSON

The primary export format is **Jira Bulk Import JSON** (compatible with the Jira CSV/JSON bulk importer). This format:
- Maps directly to Jira's issue model (summary, description, issue type, priority, labels, components, story points, epic link)
- Supports batch creation of hundreds of issues in a single import operation
- Is version-controlled and diffable (JSON over CSV for structural clarity)

Secondary formats generated in the same export pass:
- **JSON Lines (`.jsonl`)** — one work item per line; suitable for programmatic ingestion and streaming processing
- **Markdown summary table** — human-readable; suitable for PR descriptions and sprint planning reviews

### 2. Export is one-way outbound by default (`export` mode)

The default mode is **one-way outbound export only**. The skill writes files; it does not read from Jira. This keeps the default execution dependency-free (no Jira credentials required, no network call).

**`sync` mode** (bidirectional) is an opt-in mode that:
- Fetches current Jira issue status for each exported item via the Jira REST API
- Diffs against local `lifecycle_state`
- Proposes state updates via a mandatory HITL gate — no local file is modified without explicit human approval

**`webhook` mode** is a second opt-in mode for event-driven sync (Jira/GitHub/Linear webhook events → automated dispatch).

### 3. PII scrubbing is mandatory before any export file write

Before any export file is written, the skill applies a mandatory PII scrubbing pass:
- Developer names in assignment fields are hashed or replaced with role identifiers (`dev-1`, `dev-2`)
- Email addresses in description bodies are redacted (`[email redacted]`)
- Internal URLs matching a configurable pattern list are replaced with `[internal-url]`
- The scrubbing pass is non-bypassable; it cannot be disabled by any input flag

This is enforced as a security control, not a configuration option. The `strip_internal_fields` flag (`default: true`) additionally removes internal pipeline fields (`metrics`, `feedback` references) from the export payload.

### 4. `FEATURE` items map to Jira Epics

Work items of type `FEATURE` (multi-task items using the folder structure `work-items/features/FEATURE-NNN-{slug}/`) are mapped to **Jira Epic** issue type in all export formats. Child `TASK` items within a feature folder have their `jira_epic_link` field set to the parent `FEATURE` ID automatically during export.

### 5. Async, non-blocking execution

`work-item-exporter` runs as a **non-blocking async final step** at pipeline completion. It is never in the critical path of any earlier pipeline stage. Export failures (network errors, format errors, API quota exhaustion) are logged as warning feedback entries; they do not fail the pipeline.

---

## Consequences

### Positive

- **Zero infrastructure dependencies for default export** — the default `export` mode requires no Jira credentials and no network access. Any operator can run it offline.
- **Human-controlled sync** — the HITL gate on `sync` mode prevents automated overwrite of locally-valid states.
- **PII protection by default** — scrubbing is non-bypassable; developers cannot accidentally export PII-containing descriptions.
- **Pipeline safety** — async, non-blocking execution guarantees that a slow or unavailable Jira instance never stalls the pipeline.
- **FEATURE→Epic mapping** — operators do not need to manually map FEATURE items to Jira Epics; the contract handles it automatically and consistently.

### Negative / Trade-offs

- **Jira Bulk Import JSON is not real-time** — it produces a file for manual import, not a live Jira API push. Real-time ticket creation requires `sync` mode with credentials.
- **PII scrubbing is heuristic** — regex-based PII detection may miss novel patterns. It reduces risk but does not eliminate it for adversarially crafted content.
- **Three output files per export run** — operators who only need one format still receive three files. A `formats` filter is available but defaults to all three.
- **Sync mode requires Jira API token** — `sync` mode requires a Jira API token stored as an environment variable. Token rotation is the operator's responsibility (see `docs/security.md §Token Rotation`).

### Risks accepted

- Jira Bulk Import JSON format changes (Atlassian deprecating fields or changing structure) require updating the exporter skill. This is tracked as a known maintenance dependency.
- The async non-blocking pattern means export failures may go unnoticed if feedback entries are not reviewed. Operators should check the pipeline's final feedback log.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|-------------|
| Real-time Jira API push (default mode) | Requires credentials for every export run; creates pipeline dependency on Jira availability; blocks on API quota limits |
| CSV export only | Less structured than JSON; Jira's CSV importer is less reliable than its JSON importer for bulk operations |
| Linear / GitHub Issues as primary format | Jira is the dominant enterprise platform for the primary user base; additional format adapters can be added as opt-in secondary outputs |
| Auto-sync without HITL gate | Risk of automated overwrite of locally-valid lifecycle states with stale or incorrect Jira data; human review is required for any state change originating outside the pipeline |
| Opt-in PII scrubbing | Privacy risk is too high to make scrubbing opt-in; non-bypassable enforcement is the only reliable control |

---

## Review trigger

This ADR should be revisited if:
- Jira changes its Bulk Import JSON schema (Atlassian API versioning)
- A second external platform (Linear, GitHub Projects) becomes a first-class export target
- Real-time push becomes a requirement (promote `sync` mode to default, add retry/backoff)
- The PII scrubbing heuristics prove inadequate for a regulated data environment (consider a dedicated PII detection model pass)

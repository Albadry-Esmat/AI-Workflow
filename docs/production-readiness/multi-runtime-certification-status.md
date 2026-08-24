# Multi-Runtime Certification Status

**Date:** 2026-08-25
**Repository branch:** `release/production-hardening`  
**Evidence scope:** Repository-side and sandbox environment only

## Decision

No target runtime can be promoted to real-runtime or pilot-certified status from this environment. The repository-side adapters and projections are fixture-certified, but all probed terminal executables are unavailable in the sandbox and `.env` is absent. No live model, MCP, host/editor, or external-write execution was performed.

| Target | Adapter status | Sandbox probe | Live certification status |
|---|---|---|---|
| OpenCode | Reference adapter | Executable unavailable | Blocked; operator-owned |
| Claude Code | Experimental terminal adapter | Executable unavailable | Not run; operator-owned |
| OpenAI Codex CLI | Experimental terminal adapter | Executable unavailable | Not run; operator-owned |
| Gemini CLI | Experimental terminal adapter | Executable unavailable | Not run; operator-owned |
| Aider | Experimental terminal adapter | Executable unavailable | Not run; operator-owned |
| Cursor | Experimental host/editor adapter | Host integration not available in sandbox | Not run; operator-owned |
| GitHub Copilot | Experimental host adapter | Host/enterprise integration not available in sandbox | Not run; operator-owned |
| Cline/Roo Code | Experimental host/editor adapter | Host integration not available in sandbox | Not run; operator-owned |
| Windsurf | Experimental host/editor adapter | Host integration not available in sandbox | Not run; operator-owned |

## Repository-side evidence

The following controls passed without credentials or paid model calls:

| Check | Result |
|---|---:|
| Canonical adapter registry and capability matrix | PASS |
| Versioned runtime schemas | PASS |
| Sanitized runtime-certification schema and fixture validator | PASS — fixture-only evidence remains blocked for live promotion |
| All nine adapter descriptor/dry-run certifications | PASS |
| Aggregate `aiw certify-adapters` | PASS |
| Deterministic projection generation | PASS |
| Projection dry-run, conflict blocking, and explicit overwrite backup | PASS |
| Existing production conformance suite | PASS — 36 tests |
| Structural and semantic pipeline validation | PASS — 187 structural checks and 22 pipelines |
| Security history scan | PASS — current tree and reachable history |
| Dependency audit | PASS — 0 high-severity vulnerabilities |
| Website mirror check | PASS — 140 files current |

## Operator certification procedure

For each runtime, the operator must install and verify the declared version, configure credentials locally, run adapter discovery and preflight, start the `pilot-read-only` MCP profile, execute a bounded read-only smoke task, verify the approval stop, run a disposable canary, test checkpoint/resume and recovery, validate artifacts, write sanitized evidence, and obtain independent review. A runtime is promoted only for the capabilities actually evidenced.

The operator must validate the private evidence record with `aiw validate-runtime-certification <private-record.json>`. The contract distinguishes `repository-fixtures-only`, `operator-verified`, `pilot-certified`, and `blocked` states, requires staged checks and capability-level decisions, and rejects sensitive fields or credential-like values. `pilot-certified` is accepted only when version preflight, MCP profile, read-only smoke, approval stop, approved canary, recovery, artifact review, and independent review all pass on a non-fixture environment.

The operator must never send credentials, raw prompts, raw MCP payloads, session JSON, or personal data to the repository or evidence record. If a runtime cannot expose reliable approval, budget, event, checkpoint, or artifact boundaries, it remains Tier 2 degraded or Tier 3 protocol-only.

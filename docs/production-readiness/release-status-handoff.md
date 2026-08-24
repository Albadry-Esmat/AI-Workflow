# Release-Status Handoff

**Version:** 1.0.0
**Audience:** Release owners, operators, independent reviewers, and support maintainers

## Purpose

The release-status handoff report provides one deterministic, sanitized summary of repository readiness and operator-owned live gates. It is a coordination artifact, not a production approval and not a substitute for live runtime evidence.

Generate the report from the repository root:

```bash
aiw release-status
aiw release-status --json
aiw release-status --json --output /path/to/private/release-status.json
```

The optional output file is written with owner-only permissions when the operating system supports them. Do not commit a private report containing operator identity, internal project identifiers, or environment-specific details.

## Report semantics

| Field | Meaning | Safe interpretation |
|---|---|---|
| `branch` and `commit` | Source revision used for the report. | Confirm the report is tied to the intended release branch and reviewed commit. |
| `working_tree` | Whether uncommitted files were present when the report ran. | A release candidate must be `clean`; a dirty report is for diagnosis only. |
| `checks` | Documentation, website, evidence, adapter, and runtime-watch results. | All repository checks must pass before handoff. |
| `live_certification` | Whether operator-owned runtime work is still blocked or required. | It never means that live certification occurred. |
| `operator_blockers` | Sanitized missing-runtime, host-verification, or environment prerequisites. | Assign each blocker to an operator and do not bypass it. |
| `decision` | Repository-side readiness plus live-gate state. | `repository-side-ready-live-gate-blocked` is the expected sandbox result. |
| `next_action` | Sanitized handoff instruction. | Follow the operator procedure and record evidence privately. |

The report records only statuses, versions, paths, counts, and sanitized categories. It never includes credentials, token values, authorization headers, raw prompts, MCP payloads, personal data, session transcripts, or unbounded model output.

## Required handoff sequence

Run `aiw release-status` after the release branch is clean and after the documentation and website gates pass. For a named terminal runtime, also run:

```bash
aiw runtime-watch --runtime <id> --strict
```

Then complete `docs/operations/live-smoke-test.md` on a disposable or non-sensitive project. Validate the private pilot and runtime-certification records with:

```bash
aiw validate-pilot-evidence <private-pilot-record.json>
aiw validate-runtime-certification <private-runtime-certification.json>
```

The release owner compares the report with `docs/operations/release-checklist.md`, assigns every operator blocker, obtains independent review, and records a GO or NO-GO decision. A repository-side green result cannot promote a fixture, fake executable, or unavailable runtime to production-certified status.

## Sandbox result policy

In the sandbox, the report is expected to identify unavailable terminal executables, host/editor verification requirements, and a missing `.env` when those prerequisites are absent. This is a truthful blocked handoff. Do not replace those statuses with fake versions or fixture labels.

## Change-management rule

Changes to the report schema, validator, release gate, operator blocker mapping, or output semantics require updates to this guide, the relevant production runbook and compatibility-maintenance guide, `docs/changelog.md`, and the website mirror. Run `aiw docs-check`, `aiw sync`, `aiw website-check`, and `aiw sync --check` before commit.

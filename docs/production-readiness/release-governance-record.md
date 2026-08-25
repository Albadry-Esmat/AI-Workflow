# AI Workflow Release Governance Record

**Release line:** `release/production-hardening`  
**Release candidate:** Local production-hardening branch  
**Status:** Governance template active; owner and independent reviewer must be assigned before pilot sign-off.  
**Last verified commit:** See `aiw release-status --json` for the exact verified commit

## Ownership

| Responsibility | Owner | Required evidence |
|---|---|---|
| Release owner | **Pending operator assignment** | Named person or team in the release issue. |
| Independent security reviewer | **Pending operator assignment** | Signed security review. |
| Runtime/OpenCode owner | **Pending operator assignment** | Runtime version and live smoke-test evidence. |
| MCP/integration owner | **Pending operator assignment** | Permission and credential review. |
| Website publication owner | **Pending operator assignment** | Publication PR and rollback evidence. |
| State recovery owner | **Pending operator assignment** | Backup/restore and recovery rehearsal evidence. |
| Release-status handoff owner | **Pending operator assignment** | Sanitized `aiw release-status --json` report and assigned blocker register. |

The release cannot be approved for general production while the release owner and independent reviewer remain unassigned. Before handoff, run `aiw release-status --json`, verify a clean tree, assign every listed operator blocker, and attach only sanitized evidence.

## Feature Freeze

During the pilot window, new generative skills, debate modes, autonomous adaptation, and new write-capable MCP integrations are frozen. Only the following changes are permitted without release-owner approval:

| Allowed change | Required evidence |
|---|---|
| P0/P1 defect remediation | Regression test, documentation update, and rollback note. |
| Runtime compatibility fix | Clean-clone and live smoke-test rerun. |
| Security or credential fix | Secret scan, permission review, and rotation impact assessment. |
| Pilot-blocking operational fix | Reproduction, fix, conformance test, and updated runbook. |

Any other change requires explicit release-owner approval and an updated release decision.

## Change Classification

| Class | Definition | Release treatment |
|---|---|---|
| **P0** | Installation failure, credential exposure, data-integrity loss, gate bypass, unsafe external write, or unrecoverable state. | Blocks all pilot and production activity. Immediate containment and regression test required. |
| **P1** | Serious reliability, security, compatibility, or operational weakness that could cause material failure. | Blocks general production; may block the pilot depending on exposure. |
| **P2** | Non-blocking hardening, usability, documentation, or maintenance issue. | Track for the next maintenance release with an owner and due date. |
| **P3** | Optional improvement without material production-risk reduction. | Defer until post-launch review. |

## Required Change Record

Every change during the release window must record:

1. The risk class and affected release exit criterion.
2. The source commit and changed files.
3. The test commands and results.
4. Documentation and website-mirror impact.
5. The rollback procedure.
6. The reviewer and approval status.
7. The sanitized `aiw release-status --json` report and ownership of every live-gate blocker.

## Current Exceptions

| Exception | Status | Compensating control |
|---|---|---|
| Real OpenCode CLI is unavailable in the sandbox | Open | Operator must install and verify the supported CLI before pilot. |
| Production `.env` and GitHub credential are unavailable in the sandbox | Open | Operator must create a mode-600 environment and use a least-privilege fine-grained token. |
| Remote branch protection is unavailable under the current private-repository plan | Open | Require pull requests and named review operationally; enable remote protection when plan or repository visibility permits. |

## Pilot Approval Signatures

| Approval | Name | Date | Status |
|---|---|---|---|
| Release owner | Pending | Pending | Not approved |
| Independent security review | Pending | Pending | Not approved |
| Rollback review | Pending | Pending | Not approved |
| Pilot completion | Pending | Pending | Not approved |

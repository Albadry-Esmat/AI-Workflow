# Batch 0 Scope Sheet

**Batch:** 0 — Approval and Baseline  
**Status:** Complete; waiting for explicit confirmation before Batch 1  
**Selected first vertical slice:** `quick-review`

## Scope included

| Area | Included in Batch 0 |
|---|---|
| Execution boundary | Document what declarative configuration, OpenCode permissions, and MCP configuration can currently enforce |
| Data ownership | Define canonical, generated, mirrored, and website-owned fields |
| Run evidence | Decide local-first, versioned JSON evidence objects for later implementation |
| Risk policy | Define low, medium, high, and critical action tiers and approval expectations |
| Baselines | Capture branch, validation, synchronization, test, lint, and production-build results |
| Initial pipeline | Select `quick-review` for the first observable/evaluated slice |

## Scope excluded

Batch 0 does not change runtime behavior, introduce a policy gateway, rotate credentials, alter MCP permissions, redesign the website, add evaluation cases, instrument pipeline steps, change model routing, modify either `main` branch, or start Batch 1 work.

## Selected pipeline scope for later batches

`quick-review` version `1.0.0` runs:

1. `clean-code-review` version range `^1.1.0`, maximum two retries.
2. `security-review` version range `^1.0.0`, maximum two retries.
3. Both skills in one parallel group.
4. A conditional human-approval gate after `security-review` when critical vulnerabilities are present.
5. Standard token policy with automatic compression at 85% and standard budget ceiling of 16,000 tokens.

Later batches will instrument and evaluate this pipeline only before generalizing the evidence path.

## Ownership

| Responsibility | Owner |
|---|---|
| Product success criteria and release trade-offs | Product owner |
| ADRs, schemas, execution boundary | Architecture owner |
| Manifests, step records, replay, budgets | Runtime owner |
| Token guidance, risk tiers, security tests, incident controls | Security owner |
| Fixtures, graders, eval baselines, calibration | Evaluation owner |
| Canonical data, sync, release manifest | Data/release owner |
| Website presentation and website-owned editorial content | Website owner |
| Individual skill quality and versioning | Skill owner |

## Readiness checklist for Batch 1

- [x] Both repositories are on and tracking `Dev`.
- [x] `main` branches remain unchanged.
- [x] AI-Workflow validation passes.
- [x] Website lint, tests, and build pass.
- [x] AI-Workflow-to-website mirror check passes.
- [x] ADR-0001 through ADR-0004 are documented.
- [x] Baseline report is committed or available for review.
- [ ] User explicitly confirms `Start Batch 1` or `Approve Batch 1`.

## Stop condition

Work must stop after Batch 0 documentation and baseline delivery. Confirmation of this scope does not authorize implementation of Batch 1.

---
name: skill-lifecycle
description: Use when checking or advancing a skill through its lifecycle stages — from draft to active to deprecated to retired. Triggers on: "skill lifecycle", "what stage is this skill", "retire this skill", "deprecate skill", "promote skill to active", "skill status".
---

# Skill Lifecycle — End-to-End Governance

**Version:** 1.0.0 | **Last updated:** 2026-06-16

Every skill in the system passes through a defined 12-stage lifecycle. Skills cannot skip stages. The lifecycle is enforced by `skill-authoring` (SKL-012) and tracked in `skills/index.yaml` via the `status` and `version` fields.

---

## Lifecycle Stages

```
[1. Intent] → [2. Decompose] → [3. Extract] → [4. Design] → [5. Schema]
                                                                    ↓
[12. Iterate] ← [11. Monitor] ← [10. Deploy] ← [9. Register] ← [8. Validate]
                                                                    ↑
                                          [7. Reference] ← [6. SKILL.md]
```

---

## Stage Definitions

### Stage 1 — Intent Discovery

**Goal:** Confirm a skill is genuinely needed.
**Questions to answer:**
- Is this capability invokable from at least 2 different contexts?
- Does any existing skill already cover this?
- Is this atomic enough to be a skill, or is it part of a larger workflow?

**Gate:** If no to any question — stop. Reconsider the scope.

---

### Stage 2 — Problem Decomposition

**Goal:** Break the intent into atomic sub-capabilities.
**Activity:** List all the things the skill does. If the list has more than one category, split before proceeding.

**Gate:** One-sentence capability spec: "Given X, produce Y through Z." Must be writable.

---

### Stage 3 — Capability Extraction

**Goal:** Identify what is reusable vs what is context-specific.
**Activity:** Strip business logic, data specifics, and implementation details. What remains is the reusable capability.

**Gate:** The capability can be described without referencing a specific project, dataset, or technology stack.

---

### Stage 4 — Skill Design

**Goal:** Define explicit boundaries — what the skill does AND what it does not do.
**Activity:**
- Write `use_when` and `do_not_use_when`
- Identify adjacent skills and articulate how this skill differs
- Define `depends_on` (hard) and `related_skills` (soft)

**Gate:** Activation tests for adjacent skills can be written and pass.

---

### Stage 5 — Schema Definition

**Goal:** Assign all metadata fields per `skills/schema/skill-schema.yaml`.
**Activity:** Fill every required field. Assign the next available `SKL-NNN` ID tentatively (confirmed only after validation).

**Gate:** `skill-authoring` Step 4 completes without errors.

---

### Stage 6 — SKILL.md Implementation

**Goal:** Write the 13-section AI-executable specification.
**Constraint:** SKILL.md stays minimal. No examples, deep explanations, or citations — those belong in Stage 7.

**Gate:** All 13 sections are populated. Output schema includes `$defs.metrics` and `$defs.feedback_entry`.

---

### Stage 7 — Reference Documentation

**Goal:** Write the 8-section knowledge file.
**Constraint:** Must include source citations for all principles. Must have correct/incorrect code examples.

**Gate:** All 8 sections populated with minimum content (3 principles, 3 practices, 3 anti-patterns, 2 example pairs).

---

### Stage 8 — Validation

**Goal:** Multi-layer validation before registration.

| Validation Layer | What Is Checked |
|-----------------|-----------------|
| Structural | Required fields, naming patterns, paths exist |
| Semantic | Single responsibility, no overlap, clear triggers |
| Graph | No cycles, valid depends_on references, layer direction |
| Activation | Positive and negative test scenarios pass |

**Gate:** `validation_report.passed` is `true`. `quality_score.total >= 60`.

---

### Stage 9 — Registration

**Goal:** Add the skill to the live system.
**Activity:**
- Append entry to `skills/index.yaml`
- Append entry to `skills/registry.json`
- Apply `graph_delta` to `skills/graph/skill-graph.yaml`
- Trigger `doc-maintainer` (SKL-011) to update `/docs`

**Gate:** Registration is atomic — all steps succeed or none apply.

---

### Stage 10 — Deployment

**Goal:** Make the skill available for agent invocation.
**Activity:** Skill is active in the registry and can be resolved by the orchestrator.

**Status change:** `experimental` → `active`

---

### Stage 11 — Monitoring

**Goal:** Track runtime performance.

| Metric | Threshold | Action |
|--------|-----------|--------|
| Invocation frequency | Zero for 30 days | Review for deprecation |
| Activation error rate | > 5% | Refine trigger definitions |
| quality_score degradation | Drops below 60 | Trigger evolution (Stage 12) |
| Dependency hotspot | in_degree > 5 | Consider splitting or abstracting |

---

### Stage 12 — Iteration (Evolution Loop)

**Goal:** Improve the skill without breaking dependents.

| Change Type | Version Bump | Constraint |
|-------------|-------------|------------|
| Fix incorrect example or description | PATCH | No review required |
| Add new optional field, new practice | MINOR | Validation re-run required |
| Remove field, change output schema, rename skill | MAJOR | Impact analysis required — check all dependents |
| Deprecate skill | MAJOR | 2-version notice, must have replacement |

**Deprecation path:**
```
status: active → status: deprecated (with deprecation_message)
                              ↓ (after 2 MAJOR versions)
                        removed from index
```

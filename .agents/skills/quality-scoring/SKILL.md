---
name: quality-scoring
version: 1.0.0
description: 'Use when evaluating or scoring a skill before registering it. Triggers on: "score this skill", "evaluate skill quality", "is this skill good enough", "quality check", "can I register this skill", "skill quality score".'
---

# Quality Scoring — 7-Dimension Rubric

**Version:** 1.0.0 | **Last updated:** 2026-06-16

Every skill is scored on 7 dimensions with a maximum of 100 points. A skill must achieve ≥ 60 to be registered. A skill below 60 is rejected by `skill-authoring` until it improves.

---

## Scoring Dimensions

### Dimension 1 — Clarity (max 20)

*Measures trigger precision and routing unambiguity.*

| Score | Condition |
|-------|-----------|
| 18–20 | `use_when` and `do_not_use_when` unambiguously distinguish this skill from all adjacent ones. At least 3 positive + 3 negative activation tests pass against sibling skills. |
| 14–17 | Minor overlap with one adjacent skill. 3+ positive tests pass; negative tests only partially defined. |
| 10–13 | `use_when` is broad enough to match multiple contexts. Some negative tests missing. |
| 6–9 | `use_when` matches too many scenarios; `do_not_use_when` absent or vague. |
| 0–5 | No meaningful trigger definition. Routing is unpredictable. |

---

### Dimension 2 — Completeness (max 20)

*Measures coverage of the declared scope.*

| Score | Condition |
|-------|-----------|
| 18–20 | All 13 SKILL.md sections populated. All 8 knowledge file sections populated with the required minimums. Output schema has all required fields in `required[]`. |
| 14–17 | All sections present but 1–2 are thin (headers with minimal content). |
| 10–13 | 1–2 sections missing substantive content. Execution steps < 6. |
| 6–9 | Multiple sections missing or only populated with headers. Knowledge file incomplete. |
| 0–5 | SKILL.md or knowledge file absent. |

---

### Dimension 3 — Reusability (max 15)

*Measures whether the skill can be invoked independently across multiple contexts.*

| Score | Condition |
|-------|-----------|
| 13–15 | Skill has been invoked or modeled from ≥ 3 distinct calling contexts. No context-specific business logic in SKILL.md. |
| 10–12 | Works in ≥ 2 contexts. Minimal context-specific assumptions. |
| 6–9 | Works in 1 context well; theoretical fit for others. |
| 0–5 | Context-specific; cannot be meaningfully reused. |

---

### Dimension 4 — Dependency Quality (max 15)

*Measures correctness and minimalism of the dependency graph entry.*

| Score | Condition |
|-------|-----------|
| 13–15 | `depends_on` contains only hard requirements. No phantom dependencies. Dependency depth ≤ 3. No cycles. All depends_on IDs valid. |
| 10–12 | 1 phantom dependency or depth = 4. All IDs valid. |
| 6–9 | 2+ phantom dependencies or depth = 5. |
| 0–5 | Circular dependency detected (auto-rejected), or invalid IDs referenced. |

---

### Dimension 5 — Maintainability (max 15)

*Measures how easy the skill is to update without breaking dependents.*

| Score | Condition |
|-------|-----------|
| 13–15 | Output schema uses `$defs` for shared types. No breaking changes from prior version. Changelog entry present. Short, focused SKILL.md (≤ 180 lines). |
| 10–12 | Minor redundancy. Changelog present but thin. SKILL.md slightly long. |
| 6–9 | No changelog. SKILL.md duplicates knowledge file content. |
| 0–5 | No versioning. SKILL.md > 300 lines. Undocumented breaking change. |

---

### Dimension 6 — Failure Rate (max 10)

*Inverse of the skill's observed or projected failure rate.*

| Score | Condition |
|-------|-----------|
| 9–10 | ≥ 4 failure scenarios defined. Every failure has a specific fallback behavior. |
| 7–8 | 3 failure scenarios. Fallbacks defined. |
| 4–6 | 1–2 failure scenarios. Some generic fallbacks. |
| 0–3 | No failure scenarios. No fallback behavior defined. |

---

### Dimension 7 — Graph Health Contribution (max 5)

*Measures whether the skill improves the overall graph health.*

| Score | Condition |
|-------|-----------|
| 5 | Adds a new reusable node with fan-in potential. Edges are correctly typed. No increase in critical path length. |
| 3–4 | Correct node/edge types. Neutral graph health impact. |
| 1–2 | Slightly increases critical path or dependency chain length. |
| 0 | Adds phantom dependencies or increases chain depth beyond 5. |

---

## Grade Table

| Total Score | Grade | Registration Status |
|-------------|-------|---------------------|
| 90–100 | **Excellent** | Registered immediately |
| 75–89 | **Good** | Registered; minor improvements recommended |
| 60–74 | **Acceptable** | Registered; improvement required in next version |
| 40–59 | **Poor** | Blocked; refactoring required before registration |
| 0–39 | **Failing** | Blocked; rebuild required |

---

## Score Output Format

```json
{
  "dimensions": {
    "clarity":            { "score": 18, "max": 20, "notes": "..." },
    "completeness":       { "score": 17, "max": 20, "notes": "..." },
    "reusability":        { "score": 12, "max": 15, "notes": "..." },
    "dependency_quality": { "score": 13, "max": 15, "notes": "..." },
    "maintainability":    { "score": 11, "max": 15, "notes": "..." },
    "failure_rate":       { "score":  8, "max": 10, "notes": "..." },
    "graph_health":       { "score":  4, "max":  5, "notes": "..." }
  },
  "total": 83,
  "grade": "good",
  "recommendations": [
    "Add one more failure scenario to reach 9/10 on failure_rate",
    "Reduce SKILL.md to < 180 lines for top maintainability score"
  ]
}
```

---

## Automatic Score Penalties

Regardless of dimension scores, these conditions apply automatic point deductions:

| Condition | Penalty |
|-----------|---------|
| Circular dependency detected | −100 (auto-failing) |
| `validation_report.passed` is false | −50 |
| `short_description` duplicates an existing skill | −20 |
| No `do_not_use_when` field | −10 |
| Fewer than 3 activation tests (positive OR negative) | −5 each |
| Knowledge file missing source references | −5 |

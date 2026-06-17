# Skill Authoring — Knowledge Reference

**Skill ID:** SKL-012
**Version:** 1.0.0 | **Last updated:** 2026-06-16
**Mastery Level:** advanced
**Executable Skill:** [skill-authoring](../meta/skill-authoring.md)
**Primary Source:** This system's Skill System Standard; *Domain-Driven Design* — Eric Evans (2003); *Clean Architecture* — Robert C. Martin (2017)

---

## Overview

Skill authoring is the meta-capability that creates, validates, and governs all other skills. It acts simultaneously as a compiler (transforming raw knowledge into structured artifacts), a governor (enforcing quality and consistency), a graph builder (maintaining the skill dependency DAG), and an evolution engine (managing continuous improvement). Mastering skill authoring means mastering the system itself — because every skill is only as good as the authoring process that produced it.

A poorly authored skill creates worse downstream damage than no skill at all: it misdirects agents, creates ambiguous routing, causes dependency conflicts, and silently degrades system quality over time.

---

## Purpose

Apply this skill to:

- Create a new skill from raw intent or domain knowledge
- Refactor an existing skill that violates quality standards
- Split an overloaded skill into atomic, single-responsibility units
- Validate an existing skill against the schema, graph, and quality standards
- Evolve a skill to a new version with backward compatibility reasoning

---

## Principles

### P1 — Single Responsibility Rule *(Skill System Standard, Section 7.1)*

One skill = one deliverable type. A skill is overloaded when its `short_description` requires the word "and" — that is the signal to split.

**Rules:**
- A skill produces exactly one category of output artifact
- A skill has exactly one reason to change (one domain concern)
- If a skill could be described from two different caller perspectives, split it
- Test: can the skill be invoked in complete isolation and produce its full output? If it requires multiple steps from different domains, it is not atomic.

### P2 — Progressive Disclosure Architecture *(Skill System Standard, Section 3 — Three Layers)*

Skills are not monolithic documents. They are stratified into three layers that load progressively based on need:

| Layer | Content | Load Condition |
|-------|---------|----------------|
| 1 — Metadata | id, name, tags, triggers, dependencies | Always — used for routing and selection |
| 2 — SKILL.md | Execution instructions (compact) | When skill is invoked |
| 3 — Knowledge file | Examples, deep explanations, source mappings | On demand — when agent needs depth |

**Rules:**
- SKILL.md must remain minimal — it is a procedure, not a textbook
- Examples, patterns, and anti-patterns belong exclusively in Layer 3
- Agents load Layer 3 only when they need to understand context, not when executing

### P3 — Activation Accuracy First *(Skill System Standard, Section 7.3 and Section 10)*

The most important part of a skill definition is not what it does — it is when to activate it and when NOT to. Routing ambiguity costs more than missing functionality.

**Rules:**
- `use_when` must unambiguously distinguish this skill from all adjacent skills
- `do_not_use_when` must explicitly name the wrong contexts (not generic negations)
- Every new skill must have activation tests against its closest sibling skills
- Two skills with overlapping `use_when` conditions must be refactored before registration

### P4 — Graph-First Design *(Skill System Standard, Section 6)*

Every skill is a node in a directed acyclic graph. Graph integrity is more important than any individual skill's functionality — a cycle breaks the entire system.

**Edge types in the skill graph:**

| Type | Meaning | Constraint |
|------|---------|------------|
| `dependency` | Skill A requires skill B's output | Acyclic — hard rule |
| `composition` | Skill A orchestrates skill B | Acyclic — hard rule |
| `extension` | Skill A is a specialization of skill B | One-directional only |
| `co_occurrence` | A and B are often used together | Symmetric, no direction constraint |

**Rules:**
- Run cycle detection before every registration
- Flat dependency graphs are preferable — avoid chains deeper than 5 levels
- If a dependency chain is growing deep, extract a shared foundational skill

### P5 — Anti-Pattern Detection Before Registration *(Skill System Standard, Section 16)*

Validation is not optional. A skill that passes structural validation but fails semantic validation is more dangerous than one that fails structural validation — because it looks correct and will be used.

**The eight forbidden patterns that block registration:**

| Anti-pattern | Detection Signal | Action |
|-------------|-----------------|--------|
| God Skill | `short_description` contains "and" | Split into atomic skills |
| Duplicate Logic | Same `use_when` as existing skill | Merge or differentiate |
| Circular Dependency | Cycle in graph traversal | Abort — redesign dependencies |
| Vague Triggers | `use_when` is a broad category ("for all code") | Refine to specific conditions |
| Missing Negatives | No `do_not_use_when` defined | Block registration |
| Multi-Domain Responsibility | Tags span 2+ unrelated domains | Split by domain |
| Untestable Instructions | Steps cannot be verified | Rewrite for determinism |
| Missing References | `reference_path` does not exist on disk | Create knowledge file first |

---

## Practices

| Practice | Description |
|----------|-------------|
| Write `do_not_use_when` before `use_when` | Forces explicit thinking about where the skill does NOT apply — harder and more valuable |
| Scan for overlap before design | Load the current index and search for similar tags before spending time on design |
| Write one test per activation boundary | One positive test + one negative test against every adjacent skill is the minimum |
| Assign the ID last | Assign `SKL-NNN` only after validation passes — avoids polluting the index with invalid entries |
| Capability spec first | Write the one-sentence capability spec ("Given X, produce Y through Z") before any other field |

---

## Anti-patterns

### AP1 — The God Skill

**What:** A skill that covers multiple capabilities, multiple domains, or produces multiple unrelated output types.
**Why harmful:** Cannot be independently invoked, tested, or evolved. Breaks Single Responsibility. Causes routing ambiguity — the system will activate it incorrectly.
**How to fix:** Split into atomic skills — one per deliverable type. Use the `split` operation.

### AP2 — The Phantom Dependency

**What:** A skill lists `depends_on` entries that are never actually consumed in its execution.
**Why harmful:** Creates false constraints in the execution order; wastes orchestration overhead; misleads graph analysis.
**How to fix:** A dependency is hard only if the skill's execution requires the dependent skill's output. Remove phantom dependencies; move soft associations to `related_skills`.

### AP3 — Symmetric Circular Dependency

**What:** SKL-A depends on SKL-B, which depends on SKL-A.
**Why harmful:** The graph becomes unsolvable for execution ordering. The orchestrator cannot determine which to invoke first.
**How to fix:** Extract the shared concern into a third foundational skill (SKL-C) that both A and B depend on.

### AP4 — Activation Ambiguity

**What:** Two skills with `use_when` conditions that are logically identical or heavily overlapping.
**Why harmful:** The routing layer cannot determine which skill to select; agents will make random choices or always pick the first match.
**How to fix:** Add explicit differentiators to `use_when`. Add cross-references in `do_not_use_when` naming the adjacent skill: "Do not use when SKL-006 is more appropriate because..."

### AP5 — Premature Fragmentation

**What:** Splitting a skill into too many micro-skills where each one only makes sense in one pipeline.
**Why harmful:** Increases graph complexity, routing overhead, and maintenance burden without improving reusability.
**How to fix:** A skill should be splittable only if each resulting child can be invoked independently in at least 2 different contexts.

---

## Examples

### ✅ Correct — Single Responsibility with Precise Activation

```yaml
id: SKL-004
name: Clean Code Review
short_description: Analyze code against SOLID principles and detect structural anti-patterns
use_when: >
  Reviewing implementation code for quality before a merge or code review gate.
  Code must be human-authored, non-minified, and in a supported language.
do_not_use_when: >
  Code is auto-generated, compiled output, configuration markup, or SQL queries.
  For security vulnerabilities, use SKL-006 (Security Review) instead.
```

### ❌ Incorrect — God Skill with Vague Activation

```yaml
name: Code Quality
short_description: Analyze code for quality and security and documentation and tests
use_when: When working with code
# Three different skills collapsed into one; "when working with code" matches everything
```

---

### ✅ Correct — Dependency Graph (Flat, Acyclic)

```yaml
# SKL-007 depends on SKL-002 and SKL-005 — both are legitimate inputs
- id: SKL-007
  depends_on: [SKL-002, SKL-005]
  # SKL-007 does NOT depend on SKL-003 or SKL-004 (those are for SKL-005 to consume)
```

### ❌ Incorrect — Phantom Dependency Chain

```yaml
- id: SKL-007
  depends_on: [SKL-001, SKL-002, SKL-003, SKL-004, SKL-005]
  # SKL-007 only uses architecture (SKL-002) and test plan (SKL-005)
  # The other three are phantom dependencies that create false ordering constraints
```

---

### ✅ Correct — Activation Test (Positive + Negative pair)

```json
[
  {
    "scenario": "Engineer asks to review a Python service before merging",
    "context": "Source code provided; language is Python; request is code quality",
    "expected_activation": true,
    "reason": "Matches use_when: implementation code, human-authored, supported language",
    "type": "positive"
  },
  {
    "scenario": "Engineer asks to review a Python service for SQL injection",
    "context": "Source code provided; concern is a specific vulnerability type",
    "expected_activation": false,
    "reason": "Security vulnerability concerns route to SKL-006, not SKL-004",
    "type": "negative"
  }
]
```

### ❌ Incorrect — Activation Tests Without Negative Cases

```json
[
  { "scenario": "Review some code", "expected_activation": true },
  { "scenario": "Review more code", "expected_activation": true }
  // No negative tests — the skill boundary is undefined
]
```

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Schema Validation | SKL-009 | Validates generated skill schemas during step 8 |
| Documentation Maintenance | SKL-011 | Updates /docs after skill registration in step 9 |
| Orchestration | SKL-010 | Deploys registered skills into the execution pipeline |
| All skills | SKL-001–011 | skill-authoring creates and governs all of them |

---

## Source References

| Source | Chapter / Section | Linked Content |
|--------|------------------|----------------|
| *Skill System Standard* — This project | Section 7: Design Principles | P1, P2, P3 |
| *Skill System Standard* — This project | Section 6: Skill Graph System | P4 |
| *Skill System Standard* — This project | Section 16: Anti-Pattern Detection | P5 |
| *Domain-Driven Design* — Eric Evans | Ch 14: Maintaining Model Integrity | P4, AP3 |
| *Clean Architecture* — Robert C. Martin | Ch 7–11: SOLID | P1 |

---
name: trigger-engineering
description: Use ONLY when defining or improving trigger conditions for a skill — positive, negative, and edge-case activation scenarios. Triggers on: "define triggers for this skill", "improve skill triggers", "when should this skill activate", "trigger conditions", "skill routing".
---

# Trigger Engineering Template

**Version:** 1.0.0 | **Last updated:** 2026-06-16

Copy this template when defining trigger conditions for a new skill. Precise triggers are the single most important quality factor in a skill — they determine routing accuracy and prevent misactivation.

---

## Template

```yaml
# Trigger Definition for: <SKILL NAME> (SKL-NNN)

triggers:

  # ── POSITIVE TRIGGERS ─────────────────────────────────────────────
  # Contexts where this skill MUST be selected.
  # Each condition should be verifiable from the caller's context.

  positive:
    - condition: "<Caller explicitly requests this capability by name or synonym>"
      example: "User says 'analyze code quality', 'review for SOLID violations', 'check maintainability'"

    - condition: "<Specific artifact type is present in context>"
      example: "Source code file is provided; language is identified as a supported language"

    - condition: "<Pipeline stage condition that makes this skill the correct choice>"
      example: "Feature planning is complete (tasks exist) and implementation phase has begun"

  # ── NEGATIVE TRIGGERS ─────────────────────────────────────────────
  # Contexts where this skill MUST NOT be selected.
  # Name the correct alternative skill explicitly.

  negative:
    - condition: "<Adjacent concern that belongs to a different skill>"
      correct_skill: "SKL-NNN (Name)"
      example: "Caller asks about security vulnerabilities → route to SKL-006, not SKL-004"

    - condition: "<Input type that this skill cannot process>"
      example: "Code is minified, compiled, auto-generated, or is configuration markup"

    - condition: "<Pipeline stage where this skill has already run or is not yet applicable>"
      example: "Requirements are not yet defined → SKL-001 must run before this skill is relevant"

  # ── CONTEXTUAL TRIGGERS ───────────────────────────────────────────
  # Conditions that modify WHEN this skill is appropriate.
  # These refine positive triggers based on context.

  contextual:
    - condition: "<Mode or flag that changes activation behavior>"
      effect: "If X is present, activate with configuration Y"
      example: "If strictness='high', lower the complexity threshold before flagging"

    - condition: "<Prerequisite skill output that changes behavior>"
      effect: "If depends_on output is available, use it to augment analysis"
      example: "If architecture (SKL-002) output is in context, use module boundaries for scoping"

  # ── CONFLICT RESOLUTION ───────────────────────────────────────────
  # When two skills both match positive triggers, this rule determines which wins.

  conflict_resolution:
    - competing_skill: "SKL-NNN"
      resolution_rule: >
        <One sentence: what distinguishes this skill from the competing one when both match>
      example: >
        When both SKL-004 and SKL-006 match: if the concern is structural code quality,
        use SKL-004; if the concern names a specific vulnerability class, use SKL-006.
```

---

## Completed Example: `clean-code-review` (SKL-004)

```yaml
triggers:

  positive:
    - condition: "Caller requests code quality analysis, readability review, or refactoring recommendations"
      example: "User says 'review this code', 'check for SOLID violations', 'improve readability'"

    - condition: "Human-authored source code is provided in a supported language (Python, TypeScript, Go, Java)"
      example: "Input contains a code block or file path with parseable source code"

    - condition: "A code review gate is configured in the pipeline after implementation tasks complete"
      example: "Pipeline is in the quality phase; feature-planning tasks are marked complete"

  negative:
    - condition: "Caller asks about specific security vulnerabilities (injection, XSS, auth flaws)"
      correct_skill: "SKL-006 (Security Review)"
      example: "Route to SKL-006 when the concern names an OWASP category or CWE identifier"

    - condition: "Input is minified, compiled output, SQL, YAML/JSON configuration, or auto-generated code"
      example: "Code contains no whitespace or human-readable names → not reviewable"

    - condition: "No code is present; caller is describing what code should be written (future state)"
      correct_skill: "SKL-003 (Feature Planning) or SKL-002 (Architecture Design)"
      example: "Route to architecture/planning skills when the artifact is a description, not code"

  contextual:
    - condition: "strictness parameter provided"
      effect: "Adjust cyclomatic complexity threshold: low=15, medium=10, high=7"

    - condition: "architecture output (SKL-002) is in session context"
      effect: "Use module boundaries to scope review to the relevant domain layer"

  conflict_resolution:
    - competing_skill: "SKL-006 (Security Review)"
      resolution_rule: >
        SKL-004 handles structural quality (naming, complexity, SOLID). SKL-006 handles
        vulnerability categories (OWASP, CWE). When both seem applicable, check whether
        the primary concern is "is this code well-structured" (SKL-004) or
        "could this code be exploited" (SKL-006).
```

---

## Trigger Quality Rules

| Rule | Requirement |
|------|-------------|
| Minimum positive triggers | 3 |
| Minimum negative triggers | 3 |
| Minimum conflict resolution entries | 1 per adjacent skill in the same domain |
| Trigger language | Must be verifiable from caller context — no internal state, no probabilities |
| Adjacent skill naming | Negative triggers MUST name the correct alternative skill by ID and name |
| Overlapping positive triggers | If two skills share a positive trigger condition, a conflict resolution rule is mandatory |

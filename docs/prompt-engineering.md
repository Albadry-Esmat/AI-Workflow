# Prompt Engineering — Structure & Optimization

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Prompt Architecture

Every skill's markdown file IS the prompt. The system does not use separate prompt templates — the skill specification IS the instruction set for the AI agent.

```
Skill Markdown File
├── Frontmatter (name, version, domain, description)
├── Purpose (what & why)
├── Inputs (schema + table)
├── Required Context (preconditions)
├── Execution Logic (step-by-step instructions)
├── Outputs (schema + table)
├── Rules & Constraints (invariants)
├── Security Considerations (guardrails)
├── Token Optimization (efficiency rules)
├── Quality Checklist (validation items)
├── Failure Scenarios (fallback behavior)
├── Human-in-the-Loop Gates (HITL checkpoints)
└── Skill Composition (meta-skill composition definition)
```

## Prompt Structure Standards

| Section | Purpose | Token Budget |
|---------|---------|-------------|
| Frontmatter | Skill identity and metadata | ~50 tokens |
| Purpose | One-paragraph orientation | ~100 tokens |
| Inputs/Outputs | Contract definition (machine-readable JSON schema + human table) | ~500 tokens |
| Execution Logic | Step-by-step instructions (the core prompt) | ~800 tokens |
| Rules & Constraints | Invariants the AI must not violate | ~200 tokens |
| Security/Tokens/Optimization | Guardrails and efficiency | ~300 tokens |
| Quality/Failure | Validation and fallback | ~200 tokens |

**Total per skill:** ~2,150 tokens average

## Optimization Techniques

| Technique | Application | Saving |
|-----------|-------------|--------|
| JSON schemas over prose | Machine-parseable contracts replace verbose descriptions | 40-60% per field |
| `$ref` shared definitions | `$defs.metrics` and `$defs.feedback_entry` reused across all skills | ~100 tokens per skill |
| Step numbering | `Step N — Action` format compresses multi-sentence explanations | 30% per step |
| Enum constraints | Pre-populated valid values eliminate ambiguity | Eliminates clarification roundtrips |
| Table format | Structured tables vs prose descriptions | 50% per field definition |
| Abbreviated labels | `CR`/`HI`/`ME`/`LO` instead of full severity names | 25% in severity references |

## Compression Strategy

Before passing context to the next skill, the orchestrator applies:

1. **Field pruning** — Remove non-essential fields from predecessor output
2. **ID-only references** — Replace descriptive references with IDs
3. **Metrics removal** — Strip metrics from inter-skill handoffs (retained in session context)
4. **Feedback removal** — Feedback entries consumed by orchestrator, not passed downstream
5. **Schema minimization** — Keep only the fields the next skill's input schema requires

## Token Budget Management

| Context Type | Max Tokens | Compression Applied |
|-------------|------------|---------------------|
| Skill instruction (prompt) | 2,500 | Static — does not grow |
| Skill input (from upstream) | 4,000 | Pruned to required fields only |
| Session context | 32K/64K/128K (per session type) | Last 3 outputs retained |
| Execution log | 2,000 | Summarized after 20 entries |

## Prompt Reuse Strategy

- Skills ARE the prompts — no duplication between prompt files and skill files.
- Shared definitions (`$defs`) are referenced via `$ref` across all skills.
- The template (`skills/template/skill-template.md`) is the single source for structure.
- Execution logic steps are unique per skill — no shared step libraries (avoids coupling).

## Quality Checklist for Prompts

- [ ] Frontmatter contains all required fields (name, version, domain, description, author)
- [ ] Input and output schemas are valid JSON Schema (draft-07)
- [ ] No free-form prose in schema fields
- [ ] Execution steps are numbered and atomic
- [ ] Token optimization section contains concrete compression rules
- [ ] Failure scenarios cover at least 4 conditions
- [ ] Quality checklist has at least 5 checkable items

## Prompt Change Rules

- Changing a skill's prompt (its markdown file) requires testing the changed output.
- Execution logic changes require updating that skill's Quality Checklist.
- Schema changes require updating the skill's version and the registry.
- All prompt changes require an entry in `changelog.md`.

# UI/UX — Design System & User Experience

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Design Principles

1. **Clarity over complexity** — Every output should be immediately understood.
2. **Structure over verbosity** — Use tables, schemas, and structured lists over prose.
3. **Consistency** — Same patterns for same concepts across all pipeline outputs.
4. **Transparency** — Show reasoning, evidence, and confidence for all decisions.
5. **Feedback** — Clear error messages, progress indicators, and next steps.

## Output Format Standards

All pipeline skill outputs follow these conventions:

| Element | Convention | Example |
|---------|------------|---------|
| IDs | `PREFIX-NNNN` or `PREFIX-DOM-NNN` | `REQ-USR-001`, `TASK-0042` |
| Severity | `critical`, `high`, `medium`, `low`, `info` | `high` |
| Status | `ok`, `error`, `halted`, `in_progress` | `in_progress` |
| Timestamps | ISO 8601 | `2026-06-16T10:30:00Z` |
| Token counts | Integer | `4500` |
| Durations | Milliseconds | `123400` |

## HITL Gate Interface

When a HITL gate is triggered, the orchestrator presents:

```
══════════════════════════════════════════════════
HITL GATE: Architecture Approval
──────────────────────────────────────────────────
Module count: 5
Integration points: 12
Technical decisions: 3 proposed, 1 requires review
Risks: 2 (high: 1, medium: 1)
──────────────────────────────────────────────────
Action required: approve | reject | modify
Timeout: 3600s
══════════════════════════════════════════════════
```

## RTL/LTR Support

| Locale | Direction | Notes |
|--------|-----------|-------|
| English | LTR | Default |
| Arabic | RTL | Mirrored layout for structured output |

UI text supports both LTR and RTL through CSS logical properties. See [Localization](localization.md) for translation rules.

## Animation & Interaction Principles

- Minimal animations — only for state transitions (loading, gate pause, completion).
- No decorative animations — every visual element has a functional purpose.
- Progress indicators for long-running skills (estimated duration from metrics).
- Clear terminal states: success (green), failure (red), warning (yellow), info (blue).

## Structured Output Rendering

JSON output is rendered in monospace with syntax highlighting:

```json
{
  "id": "REQ-USR-001",
  "type": "F",
  "statement": "The system SHALL support user registration",
  "priority": "high"
}
```

Tables render with aligned columns:

| ID | Type | Statement | Priority |
|----|------|-----------|----------|
| REQ-USR-001 | F | The system SHALL support user registration | high |
| REQ-USR-002 | NF | The system SHALL BE responsive under 200ms | critical |

## Accessibility

- All text output is screen-reader compatible.
- Color is never the sole indicator of status (use labels + color).
- Minimum contrast ratio: 4.5:1 for normal text.
- Focus indicators for interactive elements (gates, selections).

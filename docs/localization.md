# Localization — Arabic + English i18n Strategy

**Version:** 1.0.0 | **Last updated:** 2026-06-16

## Supported Locales

| Locale | Code | Direction | Priority |
|--------|------|-----------|----------|
| English | `en` | LTR | Primary |
| Arabic | `ar` | RTL | Secondary |

## Translation Scope

| Component | Translated | Notes |
|-----------|------------|-------|
| Skill names | Yes | Domain names only (e.g., "تحليل المتطلبات") |
| Field labels | Yes | Output field display names |
| Error messages | Yes | All user-facing errors |
| HITL gate messages | Yes | Approval requests and context |
| JSON schemas | No | Schemas remain in English |
| IDs and codes | No | `REQ-USR-001`, `TASK-0042` are locale-independent |
| Logs and metrics | No | System-internal, English only |

## Translation Rules

1. **Keys, not strings** — All user-facing text uses key-based lookup:
   ```
   skill.requirement-analyzer.name → English: "Requirement Analyzer" / Arabic: "محلل المتطلبات"
   ```

2. **No embedded formatting** — Translations receive formatted data as parameters:
   ```
   gate.approval.request → "Requires approval: {count} items" / "يتطلب الموافقة: {count} عنصر"
   ```

3. **ID preservation** — IDs, codes, and numbers remain untranslated within translated text.

4. **Direction-aware layout** — RTL mirrors table columns, list ordering, and alignment.

## Locale File Structure

```
locales/
├── en/
│   ├── skills.json        # Skill names and descriptions
│   ├── gates.json         # HITL gate messages
│   ├── errors.json        # Error messages
│   └── fields.json        # Field display names
└── ar/
    ├── skills.json
    ├── gates.json
    ├── errors.json
    └── fields.json
```

## Translation File Format

```json
{
  "skill.requirement-analyzer.name": {
    "en": "Requirement Analyzer",
    "ar": "محلل المتطلبات"
  },
  "skill.requirement-analyzer.description": {
    "en": "Extracts and normalizes requirements from raw input",
    "ar": "استخراج وتطبيع المتطلبات من المدخلات الخام"
  }
}
```

## RTL Rendering Rules

- Tables reverse column order in RTL mode.
- Lists use right-aligned bullets/numbering.
- Code blocks remain LTR (left-aligned) regardless of locale.
- Mixed LTR/RTL content uses Unicode bidi markers.

## Adding a New Locale

1. Add locale directory under `locales/<code>/`.
2. Create translation JSON files matching `en/` structure.
3. Add locale to `supported_locales` in config.
4. Update this file with new locale entry.

## Localization Change Rules

- Adding a locale requires updating all translation files.
- Changing a skill name requires updating locale files AND `docs/skills-registry.md`.
- New user-facing fields require adding translation keys.

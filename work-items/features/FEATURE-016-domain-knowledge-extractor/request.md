# FEATURE-016 — Request: Domain Knowledge Extractor

**Origin:** Identified during ASE-OS enhancement analysis (2026-06-24).

---

## Problem Statement

Each pipeline run starts from scratch. The system accumulates no reusable domain knowledge across projects. If you build 5 fintech applications, the 6th starts from zero — re-discovering the same entity types, security patterns, common API shapes, and compliance requirements. This wastes tokens and increases the chance of missed domain-specific concerns.

This means:
- Token budgets are consumed re-clarifying domain context on every new project
- Domain-specific risks (HIPAA PHI exposure in healthcare, PCI scope in fintech) are not automatically surfaced — they must be re-discovered each time
- Architecture patterns proven in previous pipelines are not reused — the system cannot learn from its own outputs
- Requirement clarification rounds are longer than necessary because domain terminology must be re-established
- Common entity models (User, Transaction, Order, Patient) are redefined from scratch on each pipeline run

## Requested Behaviour

After each completed pipeline, `domain-knowledge-extractor` should:

1. **Detect the domain** from pipeline artifacts — keywords, entity names, and framework references (payments/crypto → fintech, HIPAA/PHI/EHR → healthcare, cart/checkout → ecommerce, etc.)
2. **Extract domain patterns** from each artifact category: entity patterns from db_entities, security patterns from security_findings, API patterns from architecture integration_points, compliance patterns from requirements + ADRs
3. **Deduplicate** against existing knowledge for this domain (Jaccard similarity > 0.8 → skip — prevents knowledge base bloat)
4. **Persist extracted patterns** to state-manager under `domain_knowledge.<domain>` scope for retrieval on future pipelines
5. On subsequent pipelines: **inject relevant domain knowledge** into skills that benefit from it — architecture-design receives proven entity patterns, security-review receives domain-specific risk categories, requirement-analyzer receives domain terminology

The extract operation runs asynchronously after `pipeline.ended` (non-blocking). The inject operation runs synchronously at `pipeline.started` when prior knowledge exists for the detected domain.

## Scope

- `.opencode/skills/domain-knowledge-extractor/SKILL.md` — new skill (SKL-076)
- `skills/registry.json` — register new skill
- `skills/index.yaml` — add index entry

## Out of Scope

- External knowledge sources (web scraping, API calls to regulatory databases)
- Cross-domain knowledge transfer (fintech patterns are not injected into healthcare pipelines)
- Automated requirement generation from domain knowledge (knowledge is context, not requirements)
- Knowledge base versioning or rollback
- Vector embedding or semantic search (pattern matching uses keyword classification and Jaccard similarity only)

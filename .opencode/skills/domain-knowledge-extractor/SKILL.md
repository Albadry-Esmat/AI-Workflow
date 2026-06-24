---
name: domain-knowledge-extractor
version: 1.0.0
domain: system
description: 'Use when extracting reusable domain patterns from completed pipeline artifacts, injecting prior domain knowledge into a new pipeline run, or querying the domain knowledge base for context enrichment. Triggers on: "extract domain patterns", "inject domain knowledge", "query knowledge base". Do NOT use mid-pipeline or before any pipeline has completed — the extract operation requires finalized pipeline artifacts as input.'
author: system
---

## Purpose

domain-knowledge-extractor solves the cold-start problem in repeated-domain development. After each completed pipeline, it mines the run's artifacts (requirements, architecture, security findings, data model, ADRs) for reusable patterns and stores them in a persistent domain knowledge base keyed by domain (fintech, healthcare, ecommerce, b2b-saas, iot). On subsequent pipelines in the same domain, the orchestrator injects the accumulated knowledge as structured context into skills that benefit from it — reducing token consumption for re-clarification, surfacing domain-specific risks earlier, and reusing proven architectural patterns without manual copy-paste.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | `string` | Yes | `"extract"` \| `"query"` \| `"inject"` \| `"list-domains"` |
| `pipeline_artifacts` | `object` | No | Requirements, architecture, ADRs, security_findings, db_entities — required for `extract` |
| `domain` | `string` | No | Domain override; auto-detected from artifacts if omitted |
| `query_intent` | `string` | No | Free-text description of what knowledge to retrieve — required for `query` |
| `target_skill` | `string` | No | Which skill will receive the injected knowledge — required for `inject` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["extract", "query", "inject", "list-domains"]
    },
    "pipeline_artifacts": {
      "type": "object",
      "properties": {
        "requirements":      { "type": "object" },
        "architecture":      { "type": "object" },
        "adrs":              { "type": "array", "items": { "type": "object" } },
        "security_findings": { "type": "array", "items": { "type": "object" } },
        "db_entities":       { "type": "array", "items": { "type": "object" } }
      }
    },
    "domain": {
      "type": "string",
      "description": "Explicit domain override. If omitted, domain is auto-detected from pipeline_artifacts."
    },
    "query_intent": {
      "type": "string",
      "description": "Free-text query for what aspect of domain knowledge to retrieve."
    },
    "target_skill": {
      "type": "string",
      "description": "The skill that will receive the injected context block (e.g. security-review, database-architect)."
    }
  },
  "required": ["operation"]
}
```

## Required Context

- For `extract`: `pipeline_artifacts` must be provided with at least one non-empty artifact category (db_entities, security_findings, or architecture.integration_points).
- For `query`: `query_intent` and `domain` must be provided (domain auto-detected from session context if omitted).
- For `inject`: `target_skill` must be one of the supported skills: `database-architect`, `security-review`, `requirement-analyzer`, `architecture-design`.
- state-manager must be accessible for reading and writing under `domain_knowledge.<domain>` scope.
- `list-domains` requires no prior context — always executable.

## Execution Logic

```
Step 1 — Dispatch operation
  Route to the appropriate execution path based on operation value.

=== extract operation ===

Step E1 — Detect domain
  If domain is provided: use it directly.
  Else: tokenize all text fields across pipeline_artifacts.
    Count keyword matches against domain classification buckets:
      fintech:    payments, crypto, transaction, ledger, KYC, AML, PCI, wallet, forex
      healthcare: HIPAA, PHI, EHR, patient, clinical, FHIR, HL7, diagnosis, prescription
      ecommerce:  cart, checkout, order, SKU, inventory, fulfillment, product, catalogue
      b2b-saas:   tenant, subscription, billing, SSO, SAML, enterprise, workspace, tier
      iot:        sensor, firmware, MQTT, edge, device, telemetry, gateway, protocol
    Assign domain with the highest match count. If no bucket scores > 0: assign "unknown".
  If detected domain has no existing entry in state_manager["domain_knowledge"]:
    Emit feedback: type=info, reason=new_domain_detected, evidence={ domain }.
  Output: detected_domain string

Step E2 — Extract entity patterns
  Iterate pipeline_artifacts.db_entities[].
  For each entity: create pattern { category: "entity", pattern_name: entity.name,
    description: "Entity with fields: <field_names>", examples: [field_names],
    frequency: 1, confidence: 0.9 }.
  Output: entity_patterns[]

Step E3 — Extract security patterns
  Iterate pipeline_artifacts.security_findings[].
  Group findings by OWASP category (A01 Broken Access Control through A10 SSRF).
  For each category with >= 1 finding: create pattern { category: "security",
    pattern_name: "<OWASP_code> <OWASP_name>", description: aggregated finding summary,
    examples: [affected artifact types], frequency: finding count in category, confidence: 0.85 }.
  Output: security_patterns[]

Step E4 — Extract API patterns
  If pipeline_artifacts.architecture.integration_points is non-empty:
    For each integration_point: record auth_pattern (bearer/api-key/OAuth2/none),
      protocol (REST/GraphQL/gRPC), versioning (header/path/none).
    Create pattern per unique (auth_pattern, protocol) combination:
      { category: "api", pattern_name: "<protocol> with <auth_pattern>",
        description: "Integration point pattern observed in architecture",
        examples: [integration_point names], frequency: count, confidence: 0.8 }.
  Output: api_patterns[]

Step E5 — Extract compliance patterns
  Scan pipeline_artifacts.requirements and pipeline_artifacts.adrs for framework names:
    GDPR, HIPAA, PCI-DSS, SOC 2, ISO 27001, CCPA, FedRAMP.
  For each framework referenced: create pattern { category: "compliance",
    pattern_name: framework_name, description: "Referenced in requirements/ADRs",
    examples: [source references], frequency: reference count, confidence: 0.9 }.
  Output: compliance_patterns[]

Step E6 — Deduplicate against existing knowledge base
  Load existing patterns from state_manager["domain_knowledge.<detected_domain>"].
  For each candidate pattern in [entity + security + api + compliance]:
    Compute Jaccard similarity:
      tokens_A = tokenize(candidate.pattern_name + " " + candidate.description)
      tokens_B = tokenize(existing.pattern_name + " " + existing.description)
      similarity = |tokens_A ∩ tokens_B| / |tokens_A ∪ tokens_B|
    If similarity > 0.8: skip candidate (mark as "deduplicated").
    If 0.5 <= similarity <= 0.8: increment existing.frequency by 1 (mark as "updated").
    If similarity < 0.5: add candidate as new pattern (mark as "new").
  Output: classified_patterns { new[], updated[], deduplicated[] }

Step E7 — Persist to knowledge base
  Generate uuid for each new pattern as pattern_id.
  Write to state_manager["domain_knowledge.<detected_domain>"]:
    Append new patterns to patterns[].
    Update existing patterns with incremented frequency.
    Set last_updated = now().
    Increment pattern_count by classified_patterns.new.length.
  Output: knowledge_base_entry { domain, patterns_added, patterns_updated, patterns_deduplicated }

Step E8 — Size guard
  Load pattern_count from state_manager["domain_knowledge.<detected_domain>"].
  If pattern_count > 200:
    Emit feedback: type=warning, reason=knowledge_base_size_exceeds_threshold,
      evidence={ domain, current_count, threshold: 200,
                 recommendation: "Run context-compressor for domain_knowledge.<domain>" }.

=== query operation ===

Step Q1 — Retrieve domain knowledge
  Load state_manager["domain_knowledge.<domain>"].
  If no entry exists: return empty query_results with info feedback.

Step Q2 — Rank by relevance
  Tokenize query_intent.
  For each pattern in knowledge base: compute token overlap score against query_intent tokens.
  Sort by overlap score descending. Return top 20 results.
  Output: query_results[] ranked by relevance

=== inject operation ===

Step I1 — Retrieve domain knowledge
  Load state_manager["domain_knowledge.<domain>"].
  If no entry exists: return empty injection_context with info feedback.

Step I2 — Filter by target_skill
  database-architect:   include only category == "entity"
  security-review:      include only category == "security"
  requirement-analyzer: include category == "entity" OR category == "compliance"
  architecture-design:  include category == "api" OR category == "entity" OR category == "compliance"

Step I3 — Format injection_context
  Build context object matching target_skill's input schema extension:
    { domain: "<domain>", known_patterns: [{ pattern_name, description, examples[], confidence }],
      confidence_note: "Patterns extracted from prior pipelines. Treat as context, not requirements." }
  Cap known_patterns at 15 entries (highest confidence first).
  Output: injection_context

=== list-domains operation ===

Step L1 — Load domain coverage
  Read all top-level keys from state_manager["domain_knowledge"].
  For each domain: include pattern_count and last_updated.
  Output: domain_coverage { <domain>: { pattern_count, last_updated } }
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `domain_patterns` | `array[object]` | Extracted patterns: `pattern_id`, `domain`, `category`, `pattern_name`, `description`, `examples`, `frequency`, `confidence` |
| `knowledge_base_entry` | `object` | Summary of what was written: domain, patterns_added, patterns_updated, patterns_deduplicated |
| `query_results` | `array[object]` | Patterns ranked by relevance to `query_intent` |
| `injection_context` | `object` | Pre-built context block formatted for `target_skill`'s input schema |
| `domain_coverage` | `object` | All domains with knowledge entries and their pattern counts |
| `metrics` | `object` | **REQUIRED.** Execution metrics |
| `feedback` | `array[object]` | **REQUIRED.** Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "domain_patterns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pattern_id":   { "type": "string", "format": "uuid" },
          "domain":       { "type": "string" },
          "category":     { "type": "string", "enum": ["entity", "security", "api", "compliance", "ui", "db"] },
          "pattern_name": { "type": "string" },
          "description":  { "type": "string" },
          "examples":     { "type": "array", "items": { "type": "string" } },
          "frequency":    { "type": "integer", "minimum": 1 },
          "confidence":   { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["pattern_id", "domain", "category", "pattern_name", "confidence"]
      }
    },
    "knowledge_base_entry": {
      "type": "object",
      "properties": {
        "domain":                  { "type": "string" },
        "patterns_added":          { "type": "integer" },
        "patterns_updated":        { "type": "integer" },
        "patterns_deduplicated":   { "type": "integer" }
      }
    },
    "query_results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pattern_id":    { "type": "string" },
          "pattern_name":  { "type": "string" },
          "description":   { "type": "string" },
          "category":      { "type": "string" },
          "confidence":    { "type": "number" },
          "relevance_score": { "type": "number" }
        },
        "required": ["pattern_id", "pattern_name", "category", "confidence"]
      }
    },
    "injection_context": {
      "type": "object",
      "properties": {
        "domain":          { "type": "string" },
        "known_patterns":  { "type": "array" },
        "confidence_note": { "type": "string" }
      }
    },
    "domain_coverage": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "pattern_count": { "type": "integer" },
          "last_updated":  { "type": "string", "format": "date-time" }
        }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["domain_coverage", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- `extract` operation MUST NOT run during an active pipeline — it is only valid after `pipeline.ended`. The orchestrator is responsible for enforcing this timing.
- Cross-domain knowledge transfer is forbidden — patterns extracted from domain `fintech` MUST NOT be injected into a `healthcare` pipeline.
- The `inject` operation returns context only; it does not modify the target skill's SKILL.md or registry entry.
- Jaccard similarity threshold is fixed at 0.8 for deduplication — it is not configurable per invocation.
- Maximum 200 patterns per domain before the size guard fires. Exceeding this does not block extraction, but triggers a warning.
- `inject` caps `known_patterns` at 15 entries (highest confidence first) to avoid bloating the target skill's context window.
- The `unknown` domain receives patterns but is never injected — inject operation returns empty context for the `unknown` domain.

## Security Considerations

- `pipeline_artifacts` may contain sensitive field names (PII field names, security finding descriptions). Do not log pattern extraction intermediate values — log counts only.
- Extracted patterns must contain only structural descriptions (entity names, OWASP categories, protocol types) — never actual data values, credentials, or PII content from the artifacts.
- `injection_context` injected into target skills must include the `confidence_note` advisory so the receiving skill treats the context as informational, not prescriptive.
- The knowledge base is stored in state-manager at project scope — validate that state-manager access is authenticated and scoped to the current project before write operations.

## Token Optimization

- `extract` uses keyword matching and schema introspection — no LLM calls for Steps E1–E6.
- Step E7 (persist) writes compact JSON only. No generation required.
- `query` computes token overlap scores on existing patterns — no LLM calls; O(N × M) complexity where N = patterns, M = query tokens.
- `inject` builds context from cached pattern structs — no LLM calls; output is a pre-formatted JSON object.
- `known_patterns` in injection_context is capped at 15 entries and trimmed to `pattern_name + description + examples` only (no full pattern object) to minimise injected context size.

## Quality Checklist

- [ ] `extract` rejects invocation without `pipeline_artifacts`
- [ ] Domain auto-detection covers all 5 supported domains correctly
- [ ] Jaccard deduplication prevents duplicate patterns on repeated extract runs
- [ ] `inject` filters patterns correctly per target_skill
- [ ] `injection_context` includes `confidence_note` in every response
- [ ] Knowledge base size guard fires at pattern_count > 200
- [ ] Patterns never contain data values — structural descriptions only
- [ ] `metrics` and `feedback` fields present in every response

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `extract` called with no `pipeline_artifacts` | `{"error": "MISSING_PIPELINE_ARTIFACTS"}` |
| `query` called without `query_intent` | `{"error": "MISSING_QUERY_INTENT"}` |
| `inject` called with unsupported `target_skill` | `{"error": "UNSUPPORTED_TARGET_SKILL", "supported": ["database-architect","security-review","requirement-analyzer","architecture-design"]}` |
| Domain knowledge empty for inject | Return `injection_context: {}` with `info` feedback — do not error |
| state-manager unavailable | `{"error": "STATE_MANAGER_UNAVAILABLE"}` — halt operation |
| Domain detected as `"unknown"` | Extract proceeds; inject returns empty context with `info` feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Knowledge base size warning | `pattern_count > 200` after extract | None | Emit warning feedback only; no pipeline halt. Human may choose to invoke context-compressor. |

> There are no mandatory HITL gates in domain-knowledge-extractor. The extract operation is asynchronous and non-blocking. The inject operation is deterministic and read-only. Both are safe to run without human intervention.

## 13. Skill Composition

```yaml
composes:
  - skill: state-manager
    version: "^1.1.0"
    input_map:
      operation: "read"
      scope: "project"
      key: "domain_knowledge"
    output_map:
      value: "existing_knowledge_base"
  - skill: requirement-analyzer
    version: "^1.2.0"
    input_map:
      domain_context: "injection_context"
    output_map:
      structured_requirements: "enriched_requirements"
  - skill: architecture-design
    version: "^1.3.0"
    input_map:
      domain_context: "injection_context"
    output_map:
      architecture: "enriched_architecture"
  - skill: security-review
    version: "^1.0.0"
    input_map:
      domain_context: "injection_context"
    output_map:
      security_report: "enriched_security_report"
  - skill: context-compressor
    version: "^1.0.0"
    input_map:
      target: "domain_knowledge.<domain>"
    output_map:
      compressed: "compressed_knowledge_base"
```

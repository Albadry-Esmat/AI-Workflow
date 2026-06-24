# FEATURE-016 — Implementation Plan: Domain Knowledge Extractor

## Target Skills / Artifacts

| Skill / Artifact | Action | Notes |
|---|---|---|
| `.opencode/skills/domain-knowledge-extractor/SKILL.md` (SKL-076) | Create | New skill — full 13-section spec |
| `skills/registry.json` | Update | Register SKL-076 with `status: draft` |
| `skills/index.yaml` | Update | Add index entry for domain-knowledge-extractor |

---

## §1 — Skill: domain-knowledge-extractor

**Purpose:** Extracts reusable domain patterns from completed pipeline artifacts and persists them to a domain knowledge base in state-manager. On subsequent pipelines, injects domain-specific context into skills that benefit from prior knowledge — reducing token consumption and surfacing domain risks earlier.

### Supported Operations

| Operation | Description | Required Inputs |
|---|---|---|
| `extract` | Mine pipeline artifacts; persist domain patterns to knowledge base | `pipeline_artifacts` |
| `query` | Retrieve ranked patterns from the knowledge base | `query_intent`, `domain` |
| `inject` | Build a formatted context block for a specific target skill | `target_skill`, `domain` |
| `list-domains` | Return all domains with knowledge entries and pattern counts | none |

### Input Schema

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
        "adrs":              { "type": "array" },
        "security_findings": { "type": "array" },
        "db_entities":       { "type": "array" }
      }
    },
    "domain":        { "type": "string", "description": "Explicit domain override; auto-detected if omitted" },
    "query_intent":  { "type": "string", "description": "Free-text description of what knowledge to retrieve" },
    "target_skill":  { "type": "string", "description": "Which skill will receive the injected context" }
  },
  "required": ["operation"]
}
```

### Output Schema (summary)

```json
{
  "domain_patterns": "array — pattern_id, domain, category, pattern_name, description, examples[], frequency, confidence",
  "knowledge_base_entry": "object — domain-keyed entry written to state-manager",
  "query_results": "array — patterns ranked by relevance to query_intent",
  "injection_context": "object — pre-built context block for target_skill's input schema",
  "domain_coverage": "object — domain → { pattern_count, last_updated }",
  "metrics":  "object",
  "feedback": "array"
}
```

### Domain Classification Keywords

| Domain | Trigger Keywords |
|---|---|
| `fintech` | payments, crypto, transaction, ledger, KYC, AML, PCI, wallet, forex |
| `healthcare` | HIPAA, PHI, EHR, patient, clinical, FHIR, HL7, diagnosis, prescription |
| `ecommerce` | cart, checkout, order, SKU, inventory, fulfillment, product, catalogue |
| `b2b-saas` | tenant, subscription, billing, SSO, SAML, enterprise, workspace, tier |
| `iot` | sensor, firmware, MQTT, edge, device, telemetry, gateway, protocol |

---

## §2 — Execution Steps: extract operation

**Step 1 — Detect domain**
If `domain` is not provided: tokenize all `pipeline_artifacts` text fields; count keyword hits per domain bucket from the classification table above; assign the highest-scoring domain. If no bucket scores > 0, assign `unknown`. Emit `new_domain_detected` feedback if the detected domain has no prior entry in `domain_knowledge`.

**Step 2 — Extract entity patterns**
Iterate `pipeline_artifacts.db_entities`. Collect: entity names, field names, primary relationships (foreign keys). Normalise into pattern structs with `category: "entity"`, `pattern_name` (entity class name), `examples` (field names), `frequency` (1 for new).

**Step 3 — Extract security patterns**
Iterate `pipeline_artifacts.security_findings`. Group by OWASP category (A01–A10). For each category with ≥ 1 finding: create a pattern with `category: "security"`, `pattern_name` (OWASP code + name), `description` (aggregated finding summary), `frequency` (count of findings in category).

**Step 4 — Extract API patterns**
Iterate `pipeline_artifacts.architecture.integration_points` (if present). For each integration point: record auth pattern (bearer/API-key/OAuth2), request shape (REST/GraphQL/gRPC), versioning strategy. Create patterns with `category: "api"`.

**Step 5 — Extract compliance patterns**
Scan `pipeline_artifacts.requirements` and `pipeline_artifacts.adrs` for regulatory framework names (GDPR, HIPAA, PCI-DSS, SOC 2, ISO 27001). For each referenced framework: create pattern with `category: "compliance"`, `pattern_name` (framework name), `description` (relevant clause references found).

**Step 6 — Deduplicate**
For each extracted pattern, compute Jaccard similarity against all existing patterns in `domain_knowledge.<domain>` in state-manager:
- `similarity = |tokens_intersection| / |tokens_union|` (token set from pattern_name + description)
- If similarity > 0.8: skip pattern (mark as deduplicated).
- If similarity 0.5–0.8: update `frequency` on the existing pattern (increment by 1).
- If similarity < 0.5: add as new pattern.

**Step 7 — Persist**
Write all unique patterns to state-manager under `domain_knowledge.<domain>.patterns`. Update `domain_knowledge.<domain>.last_updated` and `pattern_count`. Return summary: extracted count, deduplicated count, updated count.

**Step 8 — Size guard**
If `domain_knowledge.<domain>.pattern_count` exceeds 200 after write: emit `knowledge_base_size_exceeds_threshold` feedback with `type: "warning"` and recommendation to run context-compressor.

---

## §3 — Execution Steps: inject operation

**Step 1 — Retrieve domain knowledge**
Load `domain_knowledge.<domain>` from state-manager. If no entry exists: return empty `injection_context` with `info` feedback.

**Step 2 — Filter by target_skill**
Apply relevance filter:
- `database-architect` → `category: "entity"` patterns only
- `security-review` → `category: "security"` patterns only
- `requirement-analyzer` → `category: "entity"` + `category: "compliance"` patterns
- `architecture-design` → `category: "api"` + `category: "entity"` + `category: "compliance"` patterns

**Step 3 — Format injection_context**
Structure the filtered patterns as a pre-built context block matching the target skill's input schema extension field. Include: `domain`, `known_patterns` array (pattern_name + description + examples), `confidence` threshold note.

**Step 4 — Return**
Return `injection_context` for the orchestrator to prepend to the target skill's input payload.

---

## §4 — State-Manager Key Structure

```json
{
  "domain_knowledge": {
    "<domain>": {
      "last_updated": "<ISO-8601>",
      "pattern_count": 42,
      "patterns": [
        {
          "pattern_id":   "<uuid>",
          "category":     "entity | security | api | compliance | ui | db",
          "pattern_name": "<string>",
          "description":  "<string>",
          "examples":     ["<string>"],
          "frequency":    3,
          "confidence":   0.85
        }
      ]
    }
  }
}
```

---

## §5 — Orchestration Hooks

| Event | Operation | Blocking |
|---|---|---|
| `pipeline.ended` | `extract` | No — runs asynchronously |
| `pipeline.started` | `inject` (if domain knowledge exists) | Yes — must complete before first skill executes |

---

## §6 — Registry Entry

```json
{
  "id": "SKL-076",
  "name": "domain-knowledge-extractor",
  "version": "1.0.0",
  "domain": "system",
  "status": "draft",
  "phase": 7,
  "req_id": "N20"
}
```

---

## §7 — Validation

`scripts/validate-skills.sh` must pass (exit 0) after SKL-076 is registered.

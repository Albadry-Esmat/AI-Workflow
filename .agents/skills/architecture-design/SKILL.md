---
name: architecture-design
version: 1.3.0
domain: architecture
description: 'Use when asked to design a system architecture, define modules or services, plan data flow, choose technology stack, or map integration points. Triggers on: "design the architecture", "system design", "define modules", "how should the system be structured", "what tech stack".'
author: system
---

## Purpose

Translate a validated requirements document into a concrete system architecture. The skill defines module boundaries, data flow, integration contracts, and makes technology recommendations with clear trade-off reasoning. It is invoked after requirement analysis is complete. When `domain_constraints` is provided by a domain specialist (Phase 2c), those constraints are applied to module design, technology selection, and integration patterns.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Output from requirement-analyzer (must include id, type, statement) |
| `constraints` | `array[object]` | No | Technology, budget, or time constraints (field: description, type: "must"\|"must_not"\|"prefer") |
| `existing_architecture` | `object` | No | Description of existing system if this is an extension |
| `domain_constraints` | `object` | No | **NEW v1.3.0.** Domain-specific constraints from a domain specialist (ai-agent-specialist, mobile-platform-specialist, saas-enterprise-architect, systems-specialist). When present, overrides generic defaults for affected modules. |
| `research_artifact_path` | `string` | No | Path to `artifacts/research-<timestamp>.json` from `research-artifact` (SKL-112, FEATURE-009). When provided, technology decisions in Step 6 are anchored to the research artifact's evaluated alternatives and recommended options. Reduces redundant technology re-evaluation and provides an auditable decision trail. |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "requirements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" }
        },
        "required": ["id", "type", "statement"]
      }
    },
    "constraints": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "type": { "type": "string", "enum": ["must", "must_not", "prefer"] }
        }
      }
    },
    "existing_architecture": {
      "type": "object",
      "properties": {
        "description": { "type": "string" },
        "diagram_url": { "type": "string" }
      }
    },
    "domain_constraints": {
      "type": "object",
      "description": "Domain-specific constraints from a phase-2c domain specialist. Required fields depend on the domain.",
      "properties": {
        "domain":             { "type": "string", "enum": ["ai_agent","mobile","saas","enterprise","embedded_iot","game"] },
        "required_modules":   { "type": "array", "items": { "type": "string" } },
        "module_constraints": { "type": "array" },
        "integration_patterns_required": { "type": "array", "items": { "type": "string" } },
        "technology_mandates": { "type": "array", "items": { "type": "string" } },
        "technology_exclusions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "research_artifact_path": {
      "type": "string",
      "description": "Relative path to artifacts/research-<timestamp>.json from research-artifact (SKL-112, FEATURE-009). When present, Step 6 anchors technology decisions to the research artifact's recommended_option values, overriding generic defaults for covered topics."
    }
  },
  "required": ["requirements"]
}
```

## Required Context

- Requirements document from `requirement-analyzer` (or equivalent structured input).
- Constraint list if available (technology stack, budget, timeline).
- **Research artifact** (optional): when `research_artifact_path` is provided, load the JSON before Step 6 to anchor technology decisions to the evaluated alternatives produced by `research-artifact` (SKL-112). Skip redundant technology re-evaluation for topics already covered.
- **Graphify retrieval-first:** Before design, run `graphify query "existing modules and architectural patterns"` if `graphify-out/graph.json` exists. Use retrieved module nodes to discover established boundaries and avoid architectural drift — do not recreate modules that already exist with a stable boundary. Fall back to full derivation from requirements if graph unavailable.

## Execution Logic

```
Step 0 — Retrieve existing architecture context (graphify)
  If graphify-out/graph.json exists: run graphify query "existing modules, boundaries, and architectural patterns".
  Use retrieved nodes to: identify already-defined module boundaries (Step 2), surface proven pattern choices
  already in use (Step 5), and avoid duplicating integration points already modelled (Step 4).
  Fall back silently to Step 1 if graph unavailable.
  Output: existing_arch_context { module_names[], patterns_in_use[], integration_types[] }

Step 1 — Analyze functional clusters
  Group requirements by functional affinity. Each cluster becomes a candidate module.
  Output: module candidates with mapped requirement IDs

Step 2 — Define module boundaries
  Apply Domain-Driven Design heuristics: bounded contexts, aggregate roots, ubiquitous language.
  Assign clear responsibility statements to each module.
  Output: defined modules with responsibility and boundary rules

Step 3 — Design data flow
  Map data ownership per module. Define how data enters, transforms, and leaves each boundary.
  Identify event flows, synchronous vs. asynchronous channels.
  Output: data flow map with direction, protocol, and frequency

Step 4 — Identify integration points
  For each inter-module dependency, specify contract (API, event, shared database, message queue).
  Include interface shape, error handling protocol, and retry policy.

  Integration pattern selection table (apply when domain_constraints is present or pattern is ambiguous):

  | Pattern             | Use When                                         | Avoid When                                  |
  |---------------------|--------------------------------------------------|---------------------------------------------|
  | REST (HTTP/JSON)    | CRUD operations, public API, browser clients     | High-throughput streaming, <1ms latency req |
  | gRPC                | Internal service-to-service, typed contracts     | Browser clients, simple CRUD               |
  | GraphQL             | Frontend-driven data fetching, multi-client APIs | Simple single-client API, file transfers    |
  | Event/Message Queue | Decoupled async workflows, fan-out consumers     | Simple request-response, synchronous needs  |
  | Shared Database     | Simple monolith or tightly coupled modules only  | Microservices, strong boundary isolation    |
  | WebSocket           | Real-time bidirectional (chat, live updates)     | Stateless request-response patterns         |
  | Webhook             | Async third-party → system notifications         | High-volume or low-latency internal events  |
  | SSE (Server-Sent)   | Server → browser streaming (one direction)       | Client → server or bidirectional streams    |
  | File/S3             | Large binary assets, batch data transfer         | Real-time, structured queryable data        |
  | MQTT (IoT)          | Constrained devices, pub/sub telemetry           | High-payload, browser-facing APIs           |
  | CAN Bus             | Automotive real-time (domain: embedded_iot)      | Any non-automotive/industrial context       |

  Apply domain_constraints.integration_patterns_required if provided — these override defaults.
  Output: integration contract list

Step 5 — Apply patterns and scalability strategy
  Recommend architectural patterns (CQRS, Event Sourcing, Saga, Repository, etc.).
  Justify each recommendation with trade-offs against alternatives.
  Output: pattern recommendations with pros/cons table

Step 6 — Make technology decisions
  For each module, propose technology stack with rationale.
  Reference constraints and non-functional requirements.
  If research_artifact_path is provided:
    Load the JSON at research_artifact_path. For each research_result entry whose topic
    overlaps with a module's responsibility, apply recommended_option as the default
    technology selection for that module. Record source: "research_artifact" on each such
    decision. Override generic pattern defaults only where the research result covers the
    same topic. Do not apply recommendations for topics unrelated to the module.
  Output: technology decisions with alternatives considered

Step 7 — Assemble architecture document
  Combine all above into structured output.
  Output: complete architecture breakdown
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `modules` | `array[object]` | Module definitions (name, responsibility, requirements_covered) |
| `data_flow` | `array[object]` | Data flow entries (source, target, protocol, data_type, frequency) |
| `integration_points` | `array[object]` | Integration contracts (between, contract_type, interface, error_protocol) |
| `technical_decisions` | `array[object]` | Decisions (module, pattern_or_tech, rationale, alternatives, status) |
| `component_diagram` | `string` | Mermaid or ASCII component diagram description |
| `metadata` | `object` | Version, requirement coverage, token usage |
| `metrics` | `object` | Execution metrics (tokens_in, tokens_out, duration_ms, items_produced, version) |
| `feedback` | `array[object]` | Feedback loop entries for cross-skill communication |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "modules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "responsibility": { "type": "string" },
          "requirements_covered": { "type": "array", "items": { "type": "string" } },
          "dependencies": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["name", "responsibility", "requirements_covered"]
      }
    },
    "data_flow": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source": { "type": "string" },
          "target": { "type": "string" },
          "protocol": { "type": "string" },
          "data_type": { "type": "string" },
          "frequency": { "type": "string", "enum": ["realtime", "batch", "on-demand", "streaming"] }
        },
        "required": ["source", "target", "protocol", "data_type", "frequency"]
      }
    },
    "integration_points": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "between": { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 2 },
          "contract_type": { "type": "string", "enum": ["REST", "gRPC", "GraphQL", "event", "message_queue", "shared_db", "file"] },
          "interface": { "type": "string" },
          "error_protocol": { "type": "string" }
        },
        "required": ["between", "contract_type", "interface"]
      }
    },
    "technical_decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "module": { "type": "string" },
          "decision": { "type": "string" },
          "rationale": { "type": "string" },
          "alternatives": { "type": "array", "items": { "type": "string" } },
          "status": { "type": "string", "enum": ["approved", "proposed", "requires_review"] }
        },
        "required": ["module", "decision", "rationale"]
      }
    },
    "component_diagram": { "type": "string" },
    "metadata": {
      "type": "object",
      "properties": {
        "version": { "type": "string" },
        "requirement_coverage": { "type": "number", "minimum": 0, "maximum": 1 },
        "token_usage": { "type": "integer" }
      }
    },
    "metrics": { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "required": ["modules", "data_flow", "integration_points", "technical_decisions", "component_diagram", "metadata", "metrics", "feedback"],
  "$defs": {
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"]
    },
    "feedback_entry": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill": { "type": "string" },
        "target_skill": { "type": "string" },
        "reason": { "type": "string" },
        "evidence": { "type": "object" }
      },
      "required": ["type", "from_skill", "reason"]
    }
  }
}
```

## Rules & Constraints

- Every `module` MUST cover at least one requirement. Orphan modules are not allowed.
- Data flow entries MUST reference module names from `modules` array.
- `technical_decisions` MUST include at least one alternative considered (even if rejected).
- Component diagram MUST be parseable — prefer Mermaid.

## Security Considerations

- Do not expose internal IPs, ports, or credentials in any output field.
- Integration `interface` field MUST describe interface shape, not concrete connection strings.
- Flag any requirement that touches authentication, authorization, or encryption as requiring a security review.

## Token Optimization

- Compress `requirements` input to ID + statement only. Strip metadata and open_questions.
- Use short, unique module names (2-3 words max).
- Cap pattern recommendation alternatives to 2 per decision.
- Omit `data_flow` entries for intra-module flows. Only document cross-module and external flows.

## Quality Checklist

- [ ] All `requirements` IDs referenced in modules actually exist in input
- [ ] No module has zero dependencies unless it is a leaf/edge module
- [ ] Integration points are bidirectional (both directions documented or explicitly noted as unidirectional)
- [ ] Component diagram renders without syntax errors
- [ ] `requirement_coverage` >= 0.9 or exceptions documented
- [ ] Every technical decision has rationale

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| Fewer than 2 requirements | Return error: `{"error": "INSUFFICIENT_INPUT", "min_requirements": 2}` |
| No architectural pattern fits | Recommend layered architecture as default, document why |
| Constraint conflict (e.g., must use SQL but NF requires no relational DB) | Flag conflict in `risks` array, propose compromise |
| Diagram exceeds 2000 chars | Condense to structural summary text |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Architecture approval | Always — architecture affects all downstream skills | 3600s | Pause after Step 7, present full architecture to primary agent for sign-off |

- Gate presents: module count, integration points, technical decisions pending review, risks.
- If rejected: re-invoke from Step 1 with stakeholder modifications.
- If modified: apply changes, re-validate component diagram, continue.

## 13. Skill Composition

`architecture-design` is a primitive skill. Example inclusion in a meta-skill:

```yaml
composes:
  - skill: architecture-design
    version: "^1.2.0"
    input_map: { "requirements": "validated_requirements", "research_artifact_path": "research_artifact_path" }
    output_map: { "modules": "system_modules", "data_flow": "data_flow" }
```

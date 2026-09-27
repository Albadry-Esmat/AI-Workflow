---
name: api-design-architect
version: 1.0.0
domain: api
description: >
  Use when designing RESTful or HTTP APIs, generating OpenAPI 3.1 specifications, defining versioning strategies, rate limiting, pagination patterns, or error response standards. Triggers on: "design the API", "generate OpenAPI spec", "REST API design", "API versioning strategy", "rate limiting design". Do NOT use for GraphQL schema design — use graphql-architect instead, or for event-driven messaging contracts — use event-schema-designer instead.
author: system
---

## Purpose

Design production-grade RESTful and HTTP APIs following industry best practices, generating complete and implementation-ready OpenAPI 3.1 specifications. This skill goes beyond high-level API surface planning to produce fully detailed endpoint catalogs, request/response schemas, security scheme definitions, pagination contracts (cursor, offset, keyset), rate limiting headers, idempotency key patterns, error catalogs conforming to RFC 7807 Problem Details, HATEOAS link relations where appropriate, and SDK generation hints for client tooling.

The skill is the authoritative source for REST API contracts in the pipeline and is invoked after `architecture-design` has defined the module surface. It enforces consistent API conventions across all resources and versions, preventing the common drift where different teams produce incompatible endpoint shapes within the same product surface. Versioning strategy is applied uniformly — URL prefix, header, or media-type — so all downstream SDK generators, mock servers, and API gateways consume a single coherent source of truth.

By outputting a complete OpenAPI 3.1 document, this skill enables downstream tooling — mock servers, contract tests, API gateways (Kong, AWS API Gateway), and SDK generators (OpenAPI Generator, Speakeasy) — to consume the spec without manual intervention. The `endpoint_catalog` provides a human-readable summary for review gates, while `sdk_hints` carry annotations needed by code-generation tooling.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `object` | Yes | Functional and non-functional requirements from requirement-analyzer |
| `resources` | `array[string]` | Yes | List of domain entity names (e.g., `["User", "Order", "Product"]`) |
| `api_style` | `string` | No | API paradigm: `rest` \| `rpc` \| `graphql` (default: `rest`) |
| `auth_scheme` | `string` | No | Authentication: `jwt` \| `oauth2` \| `api_key` \| `mutual_tls` |
| `versioning_strategy` | `string` | No | `url` \| `header` \| `media_type` (default: `url`) |
| `pagination_style` | `string` | No | `cursor` \| `offset` \| `keyset` (default: `cursor`) |
| `context` | `object` | No | Session context: existing architecture, module boundaries, prior API versions |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "resources"],
  "properties": {
    "requirements": {
      "type": "object",
      "properties": {
        "functional":     { "type": "array", "items": { "type": "object" } },
        "non_functional": { "type": "array", "items": { "type": "object" } }
      }
    },
    "resources": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string" }
    },
    "api_style": {
      "type": "string",
      "enum": ["rest", "rpc", "graphql"],
      "default": "rest"
    },
    "auth_scheme": {
      "type": "string",
      "enum": ["jwt", "oauth2", "api_key", "mutual_tls"]
    },
    "versioning_strategy": {
      "type": "string",
      "enum": ["url", "header", "media_type"],
      "default": "url"
    },
    "pagination_style": {
      "type": "string",
      "enum": ["cursor", "offset", "keyset"],
      "default": "cursor"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture module list from `architecture-design` output — required to map resources to owning modules and derive ownership boundaries.
- Validated requirements from `requirement-analyzer` — used to derive operation semantics, SLO constraints, and access control rules.
- If `auth_scheme` is `oauth2`, a list of required scopes per resource must be derivable from the requirements or provided in `context`.
- If extending an existing API: prior OpenAPI spec must be provided in `context.existing_api_spec` to enforce additive-only changes.

## Execution Logic

```
Step 1 — Analyze resources and derive operations
  For each resource in `resources`: apply CRUD heuristics (list, get, create, update, patch, delete).
  Identify sub-resources and nested relationships (e.g., /orders/{id}/items).
  Flag resources that require non-CRUD operations (e.g., /payments/capture, /users/verify-email).
  Output: resource_map { resource, operations[], sub_resources[], custom_actions[] }

Step 2 — Define resource hierarchy and URL structure
  Apply versioning_strategy:
    url:        /v1/users, /v1/orders
    header:     X-API-Version: 2024-01-01 (date-based versioning)
    media_type: Accept: application/vnd.myapp.v1+json
  Enforce RESTful naming conventions: plural nouns, kebab-case paths, no verbs in resource paths.
  Custom actions: POST /resources/{id}/action-name (verb suffix on sub-path).
  Output: url_patterns { path, method, resource, operation, version_prefix }

Step 3 — Design request/response schemas
  For each operation: define request body schema and success response schema.
  Collection responses envelope: { data: T[], meta: { pagination }, links: { self, next, prev } }.
  Single-resource responses: { data: T, links: { self, related[] } }.
  Apply RFC 7807 error schema to ALL 4xx/5xx responses:
    { type: string(uri), title: string, status: integer, detail: string, instance: string }.
  Pagination schema by style:
    cursor: meta: { cursor: string, has_more: boolean, total_count: integer }
    offset: meta: { page: integer, per_page: integer, total_pages: integer, total_count: integer }
    keyset: meta: { next_key: string, prev_key: string, has_more: boolean }
  Output: schema_definitions (OpenAPI components/schemas entries)

Step 4 — Add security schemes
  Define security scheme components based on auth_scheme:
    jwt:        BearerAuth — HTTP bearer, bearerFormat: JWT
    oauth2:     OAuth2 authorizationCode + clientCredentials flows with per-resource scope map
    api_key:    ApiKeyAuth — header X-API-Key
    mutual_tls: mutualTLS scheme with client certificate hints in description
  Apply security requirement arrays to each non-public path operation.
  Public endpoints (health check, docs): explicitly set security: [] (empty = no auth).
  Output: security_scheme_definitions, per-operation security requirements

Step 5 — Define error catalog
  Produce standardized error codes for all HTTP status classes:
    400 BAD_REQUEST, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND,
    409 CONFLICT, 422 VALIDATION_ERROR, 429 RATE_LIMITED,
    500 INTERNAL_ERROR, 503 SERVICE_UNAVAILABLE.
  For each resource: add domain-specific error codes (e.g., ORDER_NOT_CANCELLABLE, PAYMENT_DECLINED).
  Output: error_codes[] { http_status, code, type_uri, title, description }

Step 6 — Design rate limiting and idempotency
  Rate limit response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After.
  Define limit tiers: anonymous, authenticated, premium (requests per minute/hour).
  Identify mutating write operations (POST, PUT, PATCH, DELETE) requiring idempotency keys.
  Specify Idempotency-Key header: UUID v4, 24-hour replay window, 409 on duplicate non-identical body.
  Output: rate_limiting_design { headers[], tiers[], idempotency_spec }

Step 7 — Produce OpenAPI 3.1 specification
  Assemble all components into a complete OpenAPI 3.1 document:
    info (title, version, contact, license), servers[], paths{}, components{}.
  Validate: all $ref references resolve, all required fields present, operationId unique per spec.
  OperationId naming: camelCase verb+Resource pattern (listUsers, createOrder, patchProduct).
  Output: openapi_spec — full OpenAPI 3.1 object, minified for state storage

Step 8 — Generate endpoint catalog and SDK hints
  Produce human-readable endpoint_catalog: method, path, operationId, auth, paginated, rate_limited, idempotent.
  Generate sdk_hints: tag groupings by resource, operationId conventions, pagination helper annotations.
  Output: endpoint_catalog[], sdk_hints

Step 9 — Versioning plan
  Document version lifecycle: current, deprecated (with sunset_date), retired for each active version.
  Define breaking vs. non-breaking change policy (field additions: non-breaking; removals: breaking).
  Output: versioning_plan
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `openapi_spec` | `object` | Full OpenAPI 3.1 document with all paths, schemas, and security definitions |
| `endpoint_catalog` | `array[object]` | Human-readable: method, path, description, auth, pagination, rate_limited |
| `error_codes` | `array[object]` | Standardized error catalog: code, http_status, type_uri, description |
| `versioning_plan` | `object` | Version lifecycle, breaking change policy, deprecation timeline |
| `rate_limiting_design` | `object` | Rate limit headers, tiers, idempotency requirements |
| `sdk_hints` | `object` | Tag groupings, operationId conventions, pagination helper annotations |
| `metrics` | `object` | tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills if specification gaps found |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["openapi_spec", "endpoint_catalog", "error_codes", "versioning_plan", "rate_limiting_design", "sdk_hints", "metrics", "feedback"],
  "properties": {
    "openapi_spec": {
      "type": "object",
      "required": ["openapi", "info", "paths", "components"],
      "properties": {
        "openapi":    { "type": "string", "pattern": "^3\\.1\\." },
        "info":       { "type": "object" },
        "paths":      { "type": "object" },
        "components": { "type": "object" }
      }
    },
    "endpoint_catalog": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["method", "path", "description", "auth"],
        "properties": {
          "method":       { "type": "string", "enum": ["GET","POST","PUT","PATCH","DELETE"] },
          "path":         { "type": "string" },
          "description":  { "type": "string" },
          "auth":         { "type": "string" },
          "paginated":    { "type": "boolean" },
          "rate_limited": { "type": "boolean" },
          "idempotent":   { "type": "boolean" }
        }
      }
    },
    "error_codes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "http_status", "type_uri", "description"],
        "properties": {
          "code":        { "type": "string" },
          "http_status": { "type": "integer", "minimum": 400, "maximum": 599 },
          "type_uri":    { "type": "string", "format": "uri" },
          "description": { "type": "string" }
        }
      }
    },
    "versioning_plan": {
      "type": "object",
      "properties": {
        "strategy":               { "type": "string" },
        "current_version":        { "type": "string" },
        "deprecation_policy":     { "type": "string" },
        "breaking_change_policy": { "type": "string" },
        "versions":               { "type": "array" }
      }
    },
    "rate_limiting_design": {
      "type": "object",
      "properties": {
        "headers":      { "type": "array", "items": { "type": "string" } },
        "tiers":        { "type": "array" },
        "idempotency":  { "type": "object" }
      }
    },
    "sdk_hints": {
      "type": "object",
      "properties": {
        "tag_groups":         { "type": "array" },
        "naming_convention":  { "type": "string" },
        "pagination_helpers": { "type": "array" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type", "from_skill", "reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate", "info", "warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

## Rules & Constraints

- Every resource in `resources` MUST appear in at least one path entry in `openapi_spec.paths`.
- All `$ref` references in the spec MUST resolve within `components` — dangling refs block output.
- `operationId` values MUST be unique across the entire spec (camelCase verbResource pattern enforced).
- Pagination schema MUST strictly match the declared `pagination_style` — mixing styles within one API version is a critical violation.
- RFC 7807 error envelope MUST be applied to all 4xx and 5xx responses — bare string error bodies are violations.
- Rate limiting headers MUST be documented on all endpoints where `rate_limited: true`.
- Every non-public endpoint MUST declare at least one security requirement when `auth_scheme` is provided.
- OpenAPI version field MUST be `3.1.x` — `3.0.x` is not accepted for new API designs.
- Maximum path count per invocation: 200 paths. Larger APIs must be split into multiple spec files and composed via `$ref` to an umbrella spec.

## Security Considerations

- Never include real credentials, tokens, or API keys in OpenAPI examples — use placeholders only (e.g., `"<YOUR_API_KEY>"`).
- OAuth2 scopes must follow the principle of least privilege — document each scope's access boundary explicitly.
- Flag any list endpoint without mandatory filter parameters as a data-exposure risk requiring rate limiting and authorization review.
- CORS policy recommendations must be included in `sdk_hints.cors_config` — wildcard `*` origins are a violation for authenticated APIs.
- If `mutual_tls` is selected, document certificate rotation procedure requirements in `versioning_plan.security_notes`.

## Token Optimization

- Pass `requirements` as compact objects — strip narrative fields, retain only id and statement.
- For specs with > 50 endpoints, generate `openapi_spec` in summary mode (paths without request/response examples) and store full content to state via state-manager.
- Compress `endpoint_catalog` to method + path + description only when operating near context budget.
- Aggressively use `$ref` to `components/schemas` — do not inline repeated schema shapes inline in paths.

## Quality Checklist

- [ ] Every resource from `resources` has at least one endpoint in `openapi_spec.paths`
- [ ] All `$ref` references resolve within `components` (no dangling refs)
- [ ] All `operationId` values are globally unique
- [ ] RFC 7807 error schema applied to all 4xx and 5xx responses
- [ ] Pagination schema matches declared `pagination_style` consistently
- [ ] Security requirements declared on all non-public endpoints
- [ ] Rate limiting headers documented for all rate-limited endpoints
- [ ] OpenAPI version field is `3.1.x`
- [ ] No hardcoded credentials or real tokens in any example field
- [ ] `versioning_plan` includes deprecation policy

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `resources` array is empty | Reject: `{"error": "NO_RESOURCES", "min_resources": 1}` |
| Unrecognized `auth_scheme` value | Default to `api_key`, emit `warning` feedback entry |
| More than 100 resources provided | Reject: `{"error": "TOO_MANY_RESOURCES", "max": 100}` — recommend splitting specs |
| OpenAPI `$ref` cycle detected | Flag as critical violation, break cycle with inline schema, emit error in feedback |
| Conflicting `versioning_strategy` vs. existing `context.existing_api_spec` | Use existing strategy, emit backpropagate to architecture-design |
| Non-unique `operationId` conflict | Auto-suffix with resource name and emit warning in feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Large API review | `endpoint_catalog.length > 50` | 7200s | Pause; present endpoint catalog summary to senior engineer for breaking-change risk assessment before writing to state |
| Auth scheme change | `auth_scheme` differs from `context.existing_api_spec` auth scheme | 3600s | Pause; require explicit confirmation before generating incompatible security scheme definitions |
| Breaking change in existing version | Any path removal or mandatory field addition detected in existing version | 3600s | Present diff of breaking changes and require human sign-off before spec is finalized |

- Gate presentation includes: total endpoint count, resources covered, authentication scheme, breaking changes detected.
- If rejected at HITL gate: re-invoke from Step 1 with stakeholder modifications provided in feedback.

## 13. Skill Composition

`api-design-architect` is invoked after `architecture-design` and produces contracts consumed by `code-generator`, `test-generator`, and `ci-pipeline-generator`:

```yaml
composes:
  - skill: api-design-architect
    version: "^1.0.0"
    input_map:
      requirements: "validated_requirements"
      resources:    "architecture.modules[*].name"
      auth_scheme:  "session.auth_scheme"
    output_map:
      openapi_spec:     "state.api_contract"
      endpoint_catalog: "state.endpoint_catalog"
      error_codes:      "state.api_error_catalog"
```

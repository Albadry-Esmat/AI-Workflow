---
name: caching-strategy-designer
version: 1.0.0
domain: architecture
description: >
  Use when designing multi-layer caching strategies for applications and services. Triggers on:
  "design caching strategy", "Redis cache architecture", "CDN caching setup", "cache invalidation
  design", "cache stampede prevention", "write-through vs write-behind", "cache warming strategy".
  Do NOT use for browser-side state caching (use state-management-architect) or database query
  plan optimization (use performance-guard).
author: system
---

## Purpose

Design a production-grade, multi-layer caching architecture that eliminates unnecessary compute and database load while maintaining data consistency guarantees appropriate to the application's requirements. The skill models the complete caching stack — L1 in-process heap cache (Caffeine ≥3 for JVM, LRU-cache for Node.js), L2 distributed cache (Redis Cluster ≥7, Memcached, DragonflyDB), L3 CDN/edge cache (AWS CloudFront, Fastly, Varnish ≥7) — and HTTP cache semantics (Cache-Control directives, ETag fingerprinting, Vary headers) as a coherent system rather than isolated components.

Cache invalidation is treated as the hardest problem: the skill explicitly designs event-driven invalidation pipelines (domain events → cache eviction), tag-based invalidation (CloudFront invalidation API, Varnish ban), TTL-based expiry with jitter to prevent thundering herd, and database change-data-capture (CDC) triggers (Debezium → Kafka → cache eviction consumers). Each invalidation strategy is matched to the consistency requirement of the data entity: strong consistency entities use write-through with immediate invalidation; eventual consistency entities use write-behind with TTL expiry.

Cache stampede (thundering herd) prevention is a first-class concern. The skill selects between probabilistic early expiration (XFetch algorithm), mutex/singleflight patterns (Go `singleflight.Group`, Redis `SET NX PX` distributed lock), and request coalescing (Varnish grace mode, Nginx proxy_cache_lock) based on entity read RPS. The output includes a complete Redis Cluster configuration recommendation (memory policy, keyspace notifications, persistence settings, Lua script safety) and warming strategy (pre-population via read-through at startup or async background job).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_description` | `string` | Yes | Description of the service and its data access patterns |
| `data_access_patterns` | `array[object]` | Yes | Per-entity patterns: `entity`, `read_rps`, `write_rps`, `data_size_kb`, `ttl_requirement_s`, `consistency` |
| `consistency_requirement` | `string` | No | Global default consistency level: `strong`, `eventual`, `weak`. Default: `eventual` |
| `cache_platform` | `string` | No | Primary distributed cache platform: `redis`, `memcached`, `dragonfly`, `multi`. Default: `redis` |
| `cdn_available` | `boolean` | No | Whether a CDN layer is available for L3 caching. Default: `false` |
| `write_strategy_preference` | `string` | No | Preferred write pattern: `write_through`, `write_behind`, `write_around`, `cache_aside`. Default: `cache_aside` |
| `context` | `object` | No | Upstream context (architecture, deployment_strategy) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["service_description", "data_access_patterns"],
  "properties": {
    "service_description": { "type": "string", "minLength": 20 },
    "data_access_patterns": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["entity", "read_rps", "write_rps"],
        "properties": {
          "entity":          { "type": "string" },
          "read_rps":        { "type": "number", "minimum": 0 },
          "write_rps":       { "type": "number", "minimum": 0 },
          "data_size_kb":    { "type": "number", "minimum": 0 },
          "ttl_requirement_s":{ "type": "integer", "minimum": 0 },
          "consistency":     { "type": "string", "enum": ["strong", "eventual", "weak"] }
        }
      }
    },
    "consistency_requirement": {
      "type": "string",
      "enum": ["strong", "eventual", "weak"],
      "default": "eventual"
    },
    "cache_platform": {
      "type": "string",
      "enum": ["redis", "memcached", "dragonfly", "multi"],
      "default": "redis"
    },
    "cdn_available": { "type": "boolean", "default": false },
    "write_strategy_preference": {
      "type": "string",
      "enum": ["write_through", "write_behind", "write_around", "cache_aside"],
      "default": "cache_aside"
    },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture modules from `architecture-design` (identifies service ownership of data entities).
- Database schema from `database-architect` (informs which entities are cacheable vs. transactional).
- Deployment strategy from `deployment-strategy` (CDN configuration and edge capabilities).

## Execution Logic

```
Step 1 — Classify entities by access profile
  For each entity in data_access_patterns:
    Read-heavy (read_rps > 10x write_rps): strong cache candidate
    Write-heavy (write_rps > read_rps): cache-aside or write-through with short TTL
    High-frequency + small data (data_size_kb < 1): L1 in-process cache candidate
    High-frequency + medium data (1-100 KB): L2 Redis candidate
    Large objects (data_size_kb > 100): CDN/object-store cache, not Redis
  Output: entity_classification [{ entity, profile: read_heavy|write_heavy|balanced, cache_tier }]

Step 2 — Design L1 in-process cache
  Select library per platform:
    JVM (Java/Kotlin/Scala): Caffeine v3 with maximumSize + expireAfterWrite + recordStats()
    Node.js: lru-cache v10 (ttl + max options); node-cache for simple TTL-only
    Go:     ristretto (Dgraph) or groupcache; avoid sync.Map for large caches
    Python: cachetools LRUCache or diskcache for process-level
    .NET:   IMemoryCache with SlidingExpiration and AbsoluteExpiration
  Configure per entity with read_heavy classification:
    maximumSize: calculated from JVM heap budget (< 10% of heap for hot objects)
    expireAfterWrite: entity.ttl_requirement_s or default 60s
    expireAfterAccess: 2x expireAfterWrite for session-adjacent data
  Output: l1_cache_config { platform, library, entity_configs[] }

Step 3 — Design L2 distributed cache (Redis/Memcached/DragonflyDB)
  Key design:
    Namespace: {service}:{entity}:{id} — e.g., "catalog:product:123"
    Avoid key collisions: include version prefix for schema-breaking changes: "v2:catalog:product:123"
    Hash tags for Redis Cluster: {catalog}:product:123 to colocate related keys on same slot
  TTL with jitter: ttl = base_ttl + random(-jitter, jitter) where jitter = base_ttl * 0.1
    Jitter prevents cache stampede on mass-expiry of correlated keys.
  Serialization: MessagePack (preferred, 40% smaller than JSON) or protobuf for high-volume
  Write strategies per consistency_requirement:
    strong:   write-through (update cache synchronously on every write; higher write latency)
    eventual: cache-aside (read: cache miss → DB → populate; write: invalidate cache)
    weak:     write-behind (async background write-back; risk of data loss on crash)
  Output: l2_cache_config { key_schema, ttl_policy, serialization, write_strategy_per_entity[] }

Step 4 — Design L3 CDN/edge cache (if cdn_available: true)
  Cacheable at CDN: public, non-personalized content; API responses with s-maxage
  Not cacheable at CDN: authenticated responses, real-time data, CSRF-protected endpoints
  Cache-Control directive strategy:
    Static assets (JS/CSS/images, content-hashed): Cache-Control: public, max-age=31536000, immutable
    API responses (public catalog): Cache-Control: public, s-maxage=300, stale-while-revalidate=3600
    API responses (personalized): Cache-Control: private, no-store
    HTML pages (SSR): Cache-Control: public, s-maxage=60, stale-while-revalidate=600
  Vary header: Vary: Accept-Encoding, Accept-Language (avoid Vary: Cookie — disables CDN caching)
  Surrogate keys (CloudFront: x-cache-tags, Fastly: Surrogate-Key): tag-based batch invalidation
  Output: l3_cdn_config { cacheable_endpoints[], headers[], surrogate_key_strategy, cdn_recommendation }

Step 5 — Design HTTP cache headers for service APIs
  For each read API endpoint inferred from data_access_patterns:
    GET /{entity}/{id} (public):      Cache-Control: public, s-maxage=300, ETag: [entity_hash]
    GET /{entity}/{id} (auth):        Cache-Control: private, no-store
    GET /list (paginated, eventual):  Cache-Control: public, s-maxage=60, stale-while-revalidate=300
  ETag generation: SHA-256 of (entity_id + updated_at timestamp) — lightweight fingerprint
  Conditional requests: If-None-Match, If-Modified-Since → 304 Not Modified reduces bandwidth
  Output: http_cache_headers [{ endpoint, method, headers, etag_strategy }]

Step 6 — Design cache invalidation strategy
  Map each write operation to its invalidation targets:
    write_through: update cache in same transaction/mutex as DB write
    event-driven: domain event published → cache consumer evicts affected keys (async, eventual)
    tag-based: CloudFront/Fastly invalidation by tag on entity update
    TTL expiry: passive expiry (simplest, eventual consistency only)
  Invalidation patterns per consistency level:
    strong:   write-through + synchronous L2 DEL
    eventual: domain event → async L2 DEL (Kafka consumer or Redis pub/sub listener)
    weak:     TTL expiry only; no active invalidation
  Cache invalidation bus (for eventual): Redis pub/sub on "cache:invalidate:{entity}:{id}" channel
    or Kafka topic "cache-invalidation" with consumer group per service.
  Output: invalidation_strategy [{ entity, consistency, invalidation_pattern, trigger, target_layers[] }]

Step 7 — Design stampede prevention
  Select strategy per entity based on read_rps and TTL:
    read_rps > 1000 + TTL < 60s → XFetch probabilistic early expiration:
      Recompute probability: P = exp((t_remaining - ttl) / (delta * beta))
      where delta = recomputation time (ms), beta = 1.0 (tunable). Refresh before expiry.
    read_rps 100-1000 → Redis distributed lock (SET NX PX {lock_ttl}):
      Lock acquired → fetch from DB → populate cache → release lock.
      Other requests: spin with exponential backoff (max 3 retries).
    read_rps < 100 → singleflight (Go singleflight.Group / Redis-based collapse):
      Coalesce concurrent identical requests to a single DB fetch.
    CDN layer → Varnish grace mode or CloudFront stale-while-revalidate:
      Serve stale content while background revalidation runs.
  Output: stampede_prevention [{ entity, read_rps, strategy, config_hint }]

Step 8 — Redis cluster configuration recommendation
  Mode: Redis Cluster (≥ 3 shards, 3 replicas for HA) for read_rps > 5000; Sentinel for < 5000.
  Memory policy: allkeys-lru (general cache) | volatile-lru (mixed cache+persistent keys)
    Avoid noeviction for pure cache workloads — prefer allkeys-lru.
  Persistence: RDB snapshot (BGSAVE every 5min) for warm-restart; AOF NOT recommended for cache.
  Keyspace notifications: enable "Kx" (key events + expired events) for invalidation listeners.
  maxmemory: set to 75% of instance RAM; leave 25% for replication and Lua overhead.
  Lua script safety: lua-time-limit 5000ms; prohibit KEYS * in scripts.
  Slow log: slowlog-log-slower-than 10000 (10ms); slowlog-max-len 256.
  Output: redis_config { mode, shards, memory_policy, maxmemory_pct, persistence, keyspace_notifications, slow_log }

Step 9 — Design cold-start warming strategy
  Identify high-value entities for pre-warming (entities with read_rps > 100).
  Strategies:
    Eager warming: application startup routine reads top-N records from DB into cache.
      Risk: increases startup time; use async background thread.
    Lazy warming with read-through: first request triggers DB fetch + cache populate.
      Mitigation: pre-warm in canary deployment before traffic shift.
    Cache warming job: scheduled job (cron / k8s CronJob) refreshes TTL-expiring hot keys.
    Shadow traffic replay: replay production read traffic against new cache instance before go-live.
  Output: warming_strategy { approach, entities[], warm_startup_cmd_hint, estimated_warm_time_s }

Step 10 — Estimate cache hit rates and ROI
  For each entity: estimate_hit_rate = read_rps / (read_rps + invalidation_rate)
    where invalidation_rate ≈ write_rps * invalidation_fan_out.
  Compute DB load reduction: (estimated_hit_rate * read_rps) = requests absorbed by cache.
  Output: estimated_hit_rate [{ entity, hit_rate_pct, db_rps_reduction }]

Step 11 — Assemble caching strategy document
  Combine all step outputs into structured caching architecture spec.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `cache_topology` | `object` | Layer map: L1/L2/L3 platforms, responsibilities, entity assignments |
| `cache_strategies` | `array[object]` | Per-entity: cache level, write pattern, TTL, invalidation strategy |
| `redis_config` | `object` | Cluster mode, memory policy, maxmemory %, persistence, keyspace config |
| `http_cache_headers` | `array[object]` | Per-endpoint Cache-Control, ETag, Vary headers |
| `stampede_prevention` | `array[object]` | Per-entity: strategy (XFetch, mutex, singleflight), config hint |
| `invalidation_strategy` | `array[object]` | Per-entity: pattern, trigger, target layers |
| `warming_strategy` | `object` | Approach, entities, startup command hint, estimated warm time |
| `estimated_hit_rate` | `array[object]` | Per-entity hit rate % and DB RPS reduction estimate |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["cache_topology", "cache_strategies", "redis_config", "http_cache_headers",
               "stampede_prevention", "warming_strategy", "estimated_hit_rate", "metrics", "feedback"],
  "properties": {
    "cache_topology": {
      "type": "object",
      "properties": {
        "layers": { "type": "array" },
        "platforms": { "type": "object" },
        "responsibilities": { "type": "object" }
      }
    },
    "cache_strategies": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["entity", "cache_level", "pattern", "ttl_s", "invalidation_strategy"],
        "properties": {
          "entity":               { "type": "string" },
          "cache_level":          { "type": "string", "enum": ["L1", "L2", "L3", "L1+L2", "L2+L3"] },
          "pattern":              { "type": "string" },
          "ttl_s":                { "type": "integer" },
          "invalidation_strategy":{ "type": "string" }
        }
      }
    },
    "redis_config": {
      "type": "object",
      "properties": {
        "mode":                   { "type": "string", "enum": ["standalone", "sentinel", "cluster"] },
        "shards":                 { "type": "integer" },
        "memory_policy":          { "type": "string" },
        "maxmemory_pct":          { "type": "integer" },
        "persistence":            { "type": "string" },
        "keyspace_notifications": { "type": "string" },
        "slow_log_threshold_us":  { "type": "integer" }
      }
    },
    "http_cache_headers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["endpoint", "headers"],
        "properties": {
          "endpoint": { "type": "string" },
          "method":   { "type": "string" },
          "headers":  { "type": "object" }
        }
      }
    },
    "stampede_prevention": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["entity", "strategy"],
        "properties": {
          "entity":      { "type": "string" },
          "read_rps":    { "type": "number" },
          "strategy":    { "type": "string" },
          "config_hint": { "type": "string" }
        }
      }
    },
    "invalidation_strategy": { "type": "array" },
    "warming_strategy": { "type": "object" },
    "estimated_hit_rate": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "entity":           { "type": "string" },
          "hit_rate_pct":     { "type": "number" },
          "db_rps_reduction": { "type": "number" }
        }
      }
    },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in": { "type": "integer" }, "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" }, "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" }, "target_skill": { "type": "string" },
          "reason": { "type": "string" }, "evidence": { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- `Cache-Control: private, no-store` MUST be applied to all authenticated/personalized endpoints — no exceptions.
- `allkeys-lru` MUST be the Redis `maxmemory-policy` for pure-cache deployments. `noeviction` is blocked.
- TTL values MUST include jitter (± 10%) to prevent synchronized expiry stampedes.
- Redis Cluster MUST be recommended when total read_rps across all entities exceeds 5000.
- Lua scripts in Redis MUST NOT use `KEYS *` pattern — flag as security and performance violation.
- `Cache-Control: immutable` MUST only be applied to content-hashed asset URLs — never to entity API endpoints.
- Strong consistency entities MUST use write-through; TTL-only invalidation for strong consistency is a blocking error.

## Security Considerations

- Cache keys MUST NOT contain raw user IDs or session tokens in plaintext if the cache is accessible by multiple services — use opaque hashed identifiers.
- Redis AUTH and TLS (`requirepass` + `tls-port`) are mandatory for any cache instance accessible over a network. In-process L1 cache is exempt.
- Sensitive data (PII, tokens) cached in Redis MUST be encrypted at the application layer before storage (AES-256-GCM) — Redis encryption-at-rest alone is insufficient.
- Cache poisoning: validate cache content structure on read-through to detect corrupted or tampered entries before serving.
- Distributed lock TTL must exceed the maximum expected computation time to prevent premature lock release and double-population.

## Token Optimization

- Skip L3 CDN design steps when `cdn_available: false`.
- Compress `data_access_patterns` to entity name + read_rps + write_rps for classification steps; expand data_size and TTL only for config steps.
- Return `redis_config` as a flat key-value object — not a rendered `redis.conf` file (code-generator handles file rendering).

## Quality Checklist

- [ ] Every entity in `data_access_patterns` has a corresponding entry in `cache_strategies`
- [ ] All `Cache-Control: private` directives applied to authenticated endpoints
- [ ] `redis_config.memory_policy` is not `noeviction` for pure-cache deployments
- [ ] TTL jitter applied to all L2 entries
- [ ] `stampede_prevention` covers all entities with `read_rps > 100`
- [ ] Strong consistency entities use write-through invalidation (not TTL-only)
- [ ] `warming_strategy` covers all entities with `read_rps > 100`

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `data_access_patterns` empty | Reject: `{"error": "NO_ACCESS_PATTERNS"}` |
| Entity `data_size_kb > 1000` recommended for Redis | Warn: recommend object storage (S3) + signed URL cache instead |
| `consistency_requirement: strong` but `write_strategy_preference: write_behind` conflict | Emit `feedback.backpropagate`, enforce write-through; document override reasoning |
| `cdn_available: false` but entity read_rps > 10000 | Emit `feedback.warning`, recommend adding CDN layer as prerequisite |
| Redis Cluster unavailable and read_rps > 50000 | Recommend DragonflyDB (multi-threaded, Redis-compatible) as alternative |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Cache architecture approval | Entities with `consistency: strong` assigned eventual invalidation strategy | 3600s | Present consistency mismatch, risk analysis, and corrected design for sign-off |

## 13. Skill Composition

```yaml
composes:
  - skill: caching-strategy-designer
    version: "^1.0.0"
    input_map:
      service_description:    "session.service_description"
      data_access_patterns:   "architecture.data_access_patterns"
      consistency_requirement:"session.consistency_level"
      cdn_available:          "deployment_strategy.cdn_enabled"
    output_map:
      cache_strategies:    "state.cache_strategies"
      redis_config:        "state.redis_config"
      http_cache_headers:  "state.http_cache_headers"
```

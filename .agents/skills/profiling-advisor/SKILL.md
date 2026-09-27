---
name: profiling-advisor
version: 1.0.0
domain: quality
description: >
  Use when analyzing application performance profiles to identify bottlenecks and recommend
  optimizations. Triggers on: "profile analysis", "flame graph interpretation", "memory leak
  investigation", "GC tuning", "EXPLAIN ANALYZE review", "N+1 query detection from traces",
  "CPU hotspot analysis", "heap dump analysis". Do NOT use for proactive performance test design
  without an existing profile — use load-test-designer instead.
author: system
---

## Purpose

The profiling-advisor skill interprets raw performance profile data — CPU flame graphs, memory heap dumps, goroutine/thread traces, GC pause event logs, database query execution plans, and network traces — to produce actionable, prioritized optimization recommendations. Rather than offering generic advice, it anchors every recommendation in specific evidence extracted from the profile (function names, allocation sites, lock contention points, slow query fingerprints) and quantifies the expected improvement in terms of CPU%, latency reduction, or memory savings.

The skill is fluent across language-specific profiling formats and toolchains: Go pprof profiles (`pprof -http=:8080 cpu.prof`), Java async-profiler flamegraphs and JVM HotSpot dumps (`jmap -dump:format=b,file=heap.hprof`), Python py-spy SVG flame graphs and memory-profiler traces, Node.js clinic.js flame charts and heapdump snapshots, .NET dotnet-trace `nettrace` files and `dotnet-dump` analysis, and Ruby stackprof profiles. It also parses PostgreSQL/MySQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output to identify missing indexes, sequential scans on large tables, nested loop join anti-patterns, and N+1 query patterns extracted from ORM query traces.

Outputs are a prioritized optimization backlog sorted by estimated ROI (impact_pct / effort_points), a set of language-specific code hints with exact function signatures or configuration parameters, and a structured hotspot table for flamegraph annotation. The skill integrates upstream of performance-guard (which enforces regressions) and downstream of load-test-designer (which surfaces the profile by running the load scenario).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profile_type` | `string` | Yes | Type of profile: `cpu`, `memory`, `goroutine`, `gc`, `database`, `network`, `combined` |
| `profile_data` | `string` | Yes | Base64-encoded profile binary, flamegraph SVG content, or EXPLAIN ANALYZE text output |
| `language` | `string` | Yes | Runtime language: `java`, `python`, `go`, `nodejs`, `dotnet`, `ruby`, `php` |
| `baseline_metrics` | `object` | No | Current production metrics: `{ p99_latency_ms, cpu_pct, memory_mb, gc_pause_ms? }` |
| `target_improvement` | `string` | No | Primary optimization dimension: `latency`, `throughput`, `memory`. Default: `latency` |
| `context` | `object` | No | `{ service_name, framework, db_engine, orm_name, cloud_provider }` |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["profile_type", "profile_data", "language"],
  "properties": {
    "profile_type": {
      "type": "string",
      "enum": ["cpu", "memory", "goroutine", "gc", "database", "network", "combined"]
    },
    "profile_data": {
      "type": "string",
      "description": "Base64-encoded pprof/hprof/nettrace binary, SVG flamegraph string, or EXPLAIN ANALYZE text"
    },
    "language": {
      "type": "string",
      "enum": ["java", "python", "go", "nodejs", "dotnet", "ruby", "php"]
    },
    "baseline_metrics": {
      "type": "object",
      "properties": {
        "p99_latency_ms": { "type": "number" },
        "cpu_pct": { "type": "number", "minimum": 0, "maximum": 100 },
        "memory_mb": { "type": "number" },
        "gc_pause_ms": { "type": "number" }
      }
    },
    "target_improvement": {
      "type": "string",
      "enum": ["latency", "throughput", "memory"],
      "default": "latency"
    },
    "context": {
      "type": "object",
      "properties": {
        "service_name": { "type": "string" },
        "framework": { "type": "string" },
        "db_engine": { "type": "string", "enum": ["postgresql", "mysql", "sqlite", "mssql", "oracle"] },
        "orm_name": { "type": "string" },
        "cloud_provider": { "type": "string" }
      }
    }
  }
}
```

## Required Context

- `profile_data` must be valid for the declared `profile_type` and `language` combination (e.g., pprof binary for Go CPU, EXPLAIN ANALYZE text for database, SVG text for flamegraph).
- `baseline_metrics` is strongly recommended: without it, impact estimates are relative (e.g., "reduces this function's share from 34% to ~8%") rather than absolute (e.g., "reduces p99 from 480ms to ~140ms").
- For `database` profile type, `context.db_engine` is required to select the correct query plan parser (PostgreSQL JSON plan vs. MySQL EXPLAIN FORMAT=JSON).
- For `goroutine` profile type (`language=go`), the skill expects pprof goroutine profile in base64 format from `pprof -alloc_space -http=:8080` or `runtime/pprof.Lookup("goroutine").WriteTo(f, 1)`.
- For GC analysis (`profile_type=gc`), Java GC logs from `-Xlog:gc*:file=gc.log:time,uptime:filecount=5,filesize=20m` are accepted as UTF-8 text in `profile_data`.

## Execution Logic

```
Step 1 — Decode and parse profile data
  Detect encoding: if profile_data starts with '<?xml' or '<svg' → SVG flamegraph (text).
  If profile_data contains 'QUERY PLAN' or 'Seq Scan' → EXPLAIN ANALYZE text.
  Otherwise: base64-decode → binary profile.
  Parse binary profile using language-specific format:
    go:     pprof protobuf (github.com/google/pprof format)
    java:   JFR recording or hprof binary; JVMTI heap snapshot XML
    python: py-spy JSON format or memory_profiler .dat format
    nodejs: V8 CPU profile JSON (cpuprofile format) or heapdump JSON
    dotnet: nettrace binary or dotnet-dump DUMPHEAP output text
    ruby:   stackprof marshal dump or rbspy flamegraph SVG
  Output: parsed_profile { type, format, sample_count, duration_s, metadata{} }

Step 2 — Extract hotspots from parsed profile
  CPU profiles: aggregate self_time and total_time per function/method.
    Top hotspots = functions where self_time > 5% of total profile time.
    For flamegraphs: parse SVG rect elements by width proportion.
  Memory profiles: aggregate allocation_bytes and live_objects per allocation site.
    Top allocators = sites contributing > 3% of total heap or > 5% of allocation rate.
  Goroutine profiles (Go): count goroutines per stack trace; flag stacks > 100 goroutines
    on same blocking call as goroutine leak candidates.
  Thread profiles (Java): identify BLOCKED threads, lock monitor contention, TIME_WAITING > 80%.
  Output: hotspots[] { function_or_site, file_line?, cpu_pct?, memory_mb?, call_count?,
                       goroutine_count?, block_reason? }

Step 3 — Analyze GC behavior (profile_type = gc or combined)
  Java G1GC: parse GC log for Pause Young (Normal), Pause Mixed, Pause Full entries.
    Flag if Pause Full GC > 0 (indicates memory pressure / humongous object allocation).
    Flag if young GC pause > 200ms (indicates Eden too small).
    Recommend: -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:G1HeapRegionSize=<computed>
               -XX:InitiatingHeapOccupancyPercent=45 (lower if mixed GC triggered too late).
  Python: check gc.get_count() deltas for reference cycle accumulation in profile logs.
    Recommend: gc.disable() in hot paths where cyclic references are absent; use __slots__.
  Go: parse runtime/trace GC events. Flag STW pause > 1ms. Recommend GOGC=200 for throughput,
    GOMEMLIMIT=<N>GiB for container deployments (Go 1.19+).
  .NET: parse dotnet-trace GC events for Gen2 collections > 10% of total GC count.
    Recommend: ObjectPooling for high-allocation types; ArrayPool<T>.Shared for buffers.
  Output: gc_analysis { runtime, pause_p99_ms, full_gc_count, recommendations[] }

Step 4 — Parse database query plans and detect anti-patterns
  PostgreSQL EXPLAIN ANALYZE JSON:
    Detect: Seq Scan on tables with rows > 10,000 without WHERE clause index = missing index.
    Detect: Nested Loop with inner rows > 1,000 = potential nested loop fan-out.
    Detect: Hash Join spill to disk (Batches > 1) = work_mem too low.
    Detect: Sort node without Index Scan = missing sort index.
  MySQL EXPLAIN FORMAT=JSON:
    Detect: type=ALL = full table scan; type=index = full index scan (bad).
    Detect: Extra='Using filesort' without index = missing composite index.
  N+1 detection: if profile_data contains ORM query trace (Django DEBUG=True log, Rails query log,
    GORM debug log, Hibernate show_sql output), group queries by fingerprint.
    Flag query patterns where N identical queries differ only by primary key value and N > 10.
    Recommend: select_related/prefetch_related (Django), includes/eager_load (Rails),
               Preload/Joins (GORM), JOIN FETCH (Hibernate).
  Output: query_plan_issues[] { query_fingerprint, issue_type, table, rows_scanned,
                                fix_description, index_ddl? }

Step 5 — Generate language-specific optimization recommendations
  For each hotspot with cpu_pct > 5% or memory_mb > 10% of total:
    Identify optimization pattern from function name and language:
      JSON serialization hot path → recommend streaming JSON (jackson-databind JsonGenerator,
        Go encoding/json decoder pools, Python orjson, Node.js fast-json-stringify)
      String concatenation in loop → recommend StringBuilder (Java), ''.join() (Python),
        strings.Builder (Go), template literals (JS)
      Regex compilation in hot path → recommend pre-compiled regexp.MustCompile (Go),
        re.compile() cached at module level (Python), new RegExp() at class scope (JS)
      Blocking I/O in async context → recommend async/await (Python asyncio), goroutines + channels,
        Promise.all() batching, Task.WhenAll() (.NET)
      Lock contention → recommend sync.RWMutex (Go), ReadWriteLock (Java),
        asyncio.Lock with timeout (Python), worker_threads (Node.js)
      Memory allocation in tight loop → recommend object pooling (sync.Pool Go,
        ObjectPool<T> .NET, commons-pool2 Java)
    Estimate gain: based on self_time_pct or allocation_pct relative to total.
    Estimate effort: 1=config change, 2=one-line fix, 3=small refactor, 5=architectural change.
  Output: optimization_recommendations[] { action, function_or_location, expected_gain_pct,
                                            effort_points, code_hint, language_specific_api }

Step 6 — Prioritize optimization backlog by ROI
  roi_score = expected_gain_pct / effort_points
  Sort optimization_recommendations by roi_score descending.
  Annotate each item with priority: HIGH (roi > 5), MEDIUM (roi 2–5), LOW (roi < 2).
  Add estimated_impact_on_baseline_metric using baseline_metrics if provided:
    latency target: new_p99 = p99_latency_ms × (1 - expected_gain_pct/100) × compound_factor
    cpu target: new_cpu = cpu_pct × (1 - expected_gain_pct/100)
    memory target: new_memory = memory_mb × (1 - expected_gain_pct/100)
  Output: optimization_backlog[] (sorted by roi_score, with priority and estimated_impact)

Step 7 — Assemble final output
  Produce bottlenecks[] by promoting top-5 hotspots to bottleneck entries with severity ratings.
  Populate all output fields. Emit feedback if baseline_metrics was absent (recommend providing it).
  Emit backpropagate to performance-guard if any HIGH-priority item suggests architectural change.
  Output: all output fields populated
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `bottlenecks` | `array` | Top issues: `{ location, type, severity: critical|high|medium, impact_estimate_pct }` |
| `optimization_recommendations` | `array` | `{ action, expected_gain_pct, effort_points, code_hint, language_specific_api }` |
| `hotspots` | `array` | Profile hotspots: `{ function, cpu_pct?, memory_mb?, call_count?, goroutine_count? }` |
| `gc_analysis` | `object` | GC findings: `{ runtime, pause_p99_ms, full_gc_count, recommendations[] }` (if applicable) |
| `query_plan_issues` | `array` | `{ query_fingerprint, issue_type, table, rows_scanned, fix_description, index_ddl? }` |
| `optimization_backlog` | `array` | Prioritized by ROI: `{ action, roi_score, priority, estimated_impact }` |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array` | Backpropagation and advisory entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["bottlenecks", "optimization_recommendations", "hotspots",
               "optimization_backlog", "metrics", "feedback"],
  "properties": {
    "bottlenecks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["location", "type", "severity", "impact_estimate_pct"],
        "properties": {
          "location": { "type": "string" },
          "type": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "impact_estimate_pct": { "type": "number" }
        }
      }
    },
    "optimization_recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["action", "expected_gain_pct", "effort_points", "code_hint"],
        "properties": {
          "action": { "type": "string" },
          "expected_gain_pct": { "type": "number" },
          "effort_points": { "type": "integer", "enum": [1, 2, 3, 5, 8] },
          "code_hint": { "type": "string" },
          "language_specific_api": { "type": "string" }
        }
      }
    },
    "hotspots": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "function": { "type": "string" },
          "cpu_pct": { "type": "number" },
          "memory_mb": { "type": "number" },
          "call_count": { "type": "integer" },
          "goroutine_count": { "type": "integer" }
        },
        "required": ["function"]
      }
    },
    "gc_analysis": {
      "type": "object",
      "properties": {
        "runtime": { "type": "string" },
        "pause_p99_ms": { "type": "number" },
        "full_gc_count": { "type": "integer" },
        "recommendations": { "type": "array", "items": { "type": "string" } }
      }
    },
    "query_plan_issues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "query_fingerprint": { "type": "string" },
          "issue_type": { "type": "string" },
          "table": { "type": "string" },
          "rows_scanned": { "type": "integer" },
          "fix_description": { "type": "string" },
          "index_ddl": { "type": "string" }
        },
        "required": ["issue_type", "fix_description"]
      }
    },
    "optimization_backlog": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "action": { "type": "string" },
          "roi_score": { "type": "number" },
          "priority": { "type": "string", "enum": ["HIGH", "MEDIUM", "LOW"] },
          "estimated_impact": { "type": "string" }
        },
        "required": ["action", "roi_score", "priority"]
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "hotspots_identified": { "type": "integer" },
        "recommendations_produced": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "hotspots_identified", "version"]
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" },
          "target_skill": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["type", "from_skill", "reason"]
      }
    }
  }
}
```

## Rules & Constraints

- Impact estimates MUST be evidence-based (tied to measured hotspot percentages) — never invented numbers.
- When `baseline_metrics` is absent, all impact estimates are relative percentages, not absolute metric improvements; this limitation MUST be noted in feedback.
- N+1 detection threshold is 10 identical queries differing only by primary key — lower thresholds produce excessive noise.
- GC analysis recommendations MUST specify exact JVM flags, GOGC/GOMEMLIMIT values, or language-specific config keys — never vague "tune the GC" advice.
- Index DDL suggestions for `query_plan_issues` MUST be marked as advisory — schema changes require database-guard review before applying.
- Effort points use Fibonacci-like scale: 1 (config tweak), 2 (one-liner), 3 (small function refactor), 5 (module-level change), 8 (architectural refactor).
- Prioritize `target_improvement` dimension: if `latency`, weight hotspots on critical-path functions first; if `memory`, weight allocation sites first.
- At most 10 `optimization_backlog` items are returned in the primary output; remaining items are written to state as extended backlog.

## Security Considerations

- `profile_data` may contain sensitive information (function names revealing business logic, SQL queries with table schemas, heap dumps with in-memory PII). Mark profile artifacts as internal-only and never log them.
- Heap dump analysis (`profile_type=memory`) may expose in-memory credentials or session tokens — the skill must not echo raw heap data in output; only function/allocation site metadata.
- SQL query fingerprints in `query_plan_issues` must redact literal values (e.g., `WHERE user_id = ?` not `WHERE user_id = 12345`) to avoid leaking identifiers.

## Token Optimization

- Pass `profile_data` as base64-encoded binary or compact SVG; strip SVG metadata attributes that are not width/function-name data.
- Provide `baseline_metrics` as a flat object with only numeric values — omit labels and units (use field name conventions).
- Limit `context.orm_name` to a single string identifier — the skill uses it only for N+1 recommendation phrasing, not for parsing.

## Quality Checklist

- [ ] Each `bottleneck` entry traces to a specific hotspot or query plan issue — no generic entries
- [ ] `expected_gain_pct` values are derived from measured hotspot `cpu_pct` or `memory_mb` share
- [ ] `effort_points` uses only Fibonacci-scale values: 1, 2, 3, 5, 8
- [ ] `gc_analysis` populated when `profile_type` is `gc` or `combined`
- [ ] `query_plan_issues` includes `index_ddl` for every `Seq Scan` finding where an index is applicable
- [ ] `optimization_backlog` is sorted by `roi_score` descending with `priority` labels assigned
- [ ] SQL query fingerprints in output have literal values redacted to `?` placeholders
- [ ] `feedback` includes a `warning` when `baseline_metrics` is absent

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `profile_data` is invalid or undecodable | Emit error in feedback with format detection attempt result; return empty hotspots with guidance on correct format |
| `language` and `profile_type` combination is unsupported (e.g., goroutine + java) | Emit `warning`; fall back to generic CPU profile analysis if possible |
| `profile_data` appears to contain PII in heap dump | Redact values in all output fields; emit `warning` noting potential PII in source data |
| `database` profile type with unknown `db_engine` | Default to PostgreSQL EXPLAIN ANALYZE parser; emit `info` noting the assumption |
| No hotspots above 5% CPU or 3% memory threshold | Return empty hotspots with `info`: "Profile appears well-distributed; no dominant hotspot detected" |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Architectural refactor recommended | Any `optimization_backlog` item has `effort_points=8` | 3600s | Pause; present backlog item to human for priority approval before emitting backpropagate |
| Heap dump contains potential PII | Base64-decoded data contains email regex or credit card pattern | 600s | Pause immediately; require human to confirm safe processing before continuing analysis |

## 13. Skill Composition

```yaml
composes_with:
  - skill: load-test-designer
    role: upstream
    note: "load-test-designer generates the load scenario that produces the profile_data artifact"
  - skill: performance-guard
    role: downstream
    note: "performance-guard uses optimization_backlog to enforce regression gates pre-release"
  - skill: database-architect
    role: downstream
    note: "database-architect receives query_plan_issues[].index_ddl recommendations for schema review"
  - skill: clean-code-review
    role: parallel
    note: "clean-code-review may surface the same hotspot functions as code quality issues"

input_from_state:
  - scope: load_test_results
    field: p99_latency_ms
    maps_to: baseline_metrics.p99_latency_ms

emits_events:
  - profiling.analysis.complete
  - profiling.architectural_refactor.required
```

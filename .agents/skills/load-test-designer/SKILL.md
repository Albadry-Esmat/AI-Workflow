---
name: load-test-designer
version: 1.0.0
domain: testing
description: >
  Use when designing comprehensive load and performance test suites for HTTP services, APIs, or
  distributed systems. Triggers on: "load test design", "performance test scenarios", "k6 test script",
  "SLO validation testing", "stress test plan", "spike test", "soak test", "capacity planning tests".
  Do NOT use when designing functional or integration test suites — use testing-strategy instead.
author: system
---

## Purpose

The load-test-designer skill produces complete, executable load and performance test suites that are directly calibrated against Service Level Objectives. It goes beyond generic "run N virtual users" scripts by designing scenario-specific test profiles for five distinct load patterns: load testing validates sustained operation at the target request rate; stress testing finds the system breaking point by incrementally increasing load beyond stated capacity; spike testing validates behaviour under sudden traffic bursts (flash sales, event-driven surges, batch job triggers); soak testing uncovers memory leaks, connection pool exhaustion, and resource drift over extended durations (minimum 1 hour, typically 4–24 hours); and chaos load testing simulates degraded upstream dependencies (latency injection, error-rate injection) under concurrent production-like load.

For each scenario, the skill produces fully parameterized test scripts in the selected tool — k6 (JavaScript ES6 modules with `SharedArray`, `check`, `group`, and `sleep`), Gatling (Scala simulation extending `Simulation` with `feeder` + `csv`), Locust (Python `HttpUser` with `TaskSet` and `wait_time`), or JMeter (JMX XML with `ThreadGroup`, `CSVDataSet`, `HTTPSamplerProxy`, and `ResponseAssertion`) — complete with virtual user ramp-up curves derived from Little's Law, think-time distributions, realistic data parameterization, and environment variable injection for CI/CD portability. SLO-based acceptance thresholds are emitted in each tool's native format (k6 `thresholds` block, Gatling `global` assertions, Locust custom stats hooks, JMeter aggregate assertions).

The skill is the bridge between testing-strategy (which defines what to test) and production-readiness verification (which validates the result). Output includes GitHub Actions / GitLab CI job YAML with baseline regression comparison logic (fail if p99 regresses more than 10% from previous build) and a structured JSON baseline report template for tracking performance trends across releases.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoints` | `array` | Yes | Endpoints to test: `{ path, method, expected_rps, payload_schema?, auth_required? }` |
| `slo_targets` | `object` | Yes | SLO thresholds: `{ latency_p50_ms?, latency_p95_ms?, latency_p99_ms, error_rate_pct, throughput_rps? }` |
| `test_types` | `array[string]` | No | Types to generate: `load`, `stress`, `spike`, `soak`, `chaos`. Default: `["load", "stress"]` |
| `tool` | `string` | No | Test framework: `k6`, `gatling`, `locust`, `jmeter`. Default: `k6` |
| `test_data_strategy` | `string` | No | Data strategy: `static`, `parameterized`, `generated`. Default: `parameterized` |
| `duration_minutes` | `integer` | No | Base load test duration. Default: `30`. Soak tests multiply by factor of 48 |
| `context` | `object` | No | `{ base_url, auth_token_env, environment, baseline_results_path }` |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["endpoints", "slo_targets"],
  "properties": {
    "endpoints": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["path", "method", "expected_rps"],
        "properties": {
          "path": { "type": "string" },
          "method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          "expected_rps": { "type": "number", "minimum": 0.1 },
          "payload_schema": { "type": "object" },
          "auth_required": { "type": "boolean", "default": false }
        }
      }
    },
    "slo_targets": {
      "type": "object",
      "required": ["latency_p99_ms", "error_rate_pct"],
      "properties": {
        "latency_p50_ms": { "type": "number", "minimum": 1 },
        "latency_p95_ms": { "type": "number", "minimum": 1 },
        "latency_p99_ms": { "type": "number", "minimum": 1 },
        "error_rate_pct": { "type": "number", "minimum": 0, "maximum": 100 },
        "throughput_rps": { "type": "number", "minimum": 0 }
      }
    },
    "test_types": {
      "type": "array",
      "items": { "type": "string", "enum": ["load", "stress", "spike", "soak", "chaos"] },
      "default": ["load", "stress"]
    },
    "tool": {
      "type": "string",
      "enum": ["k6", "gatling", "locust", "jmeter"],
      "default": "k6"
    },
    "test_data_strategy": {
      "type": "string",
      "enum": ["static", "parameterized", "generated"],
      "default": "parameterized"
    },
    "duration_minutes": {
      "type": "integer",
      "minimum": 5,
      "maximum": 1440,
      "default": 30
    },
    "context": {
      "type": "object",
      "properties": {
        "base_url": { "type": "string" },
        "auth_token_env": { "type": "string" },
        "environment": { "type": "string" },
        "baseline_results_path": { "type": "string" }
      }
    }
  }
}
```

## Required Context

- `endpoints[].expected_rps` drives all VU calculations via Little's Law: `VUs = RPS × avg_latency_ms / 1000`. Without it, no scenario can be sized.
- `slo_targets.latency_p99_ms` is mandatory; it is the primary threshold emitted in tool-native gate definitions.
- For `chaos` test type generation, at least one dependency service must be identifiable from system architecture context; if absent, generic HTTP error injection is used.
- Soak tests enforce a minimum 60-minute floor; `duration_minutes < 60` triggers an override with a warning.
- For JMeter output, JDK 11+ is assumed at test execution time; the skill notes this in the CI job YAML comment.

## Execution Logic

```
Step 1 — Validate inputs and compute VU targets per endpoint (Little's Law)
  For each endpoint:
    avg_latency_estimate = slo_targets.latency_p99_ms × 0.6  (conservative average ≈ 60% of p99)
    peak_vus = ceil(expected_rps × avg_latency_estimate / 1000 × 1.5)  (1.5 headroom factor)
  total_peak_vus = sum of all endpoint peak_vus weighted by expected_rps share.
  ramp_up_s = max(60, total_peak_vus × 2).
  ramp_down_s = max(30, total_peak_vus × 1).
  Output: vu_targets[] { endpoint_path, expected_rps, peak_vus, ramp_up_s, ramp_down_s }

Step 2 — Design scenario stage profiles
  load:  [{ duration: ramp_up_s, target: peak_vus },
          { duration: duration_minutes×60, target: peak_vus },
          { duration: ramp_down_s, target: 0 }]
  stress: Begin at 100% peak_vus; every 5 min add 25% until error_rate > 10% for 30s or VUs = 10×peak_vus.
          Record breaking point VU count and error rate in scenario metadata.
  spike:  [baseline 10% → instant jump to 300% for 120s → instant return to 10% → repeat 3 cycles].
          No ramp; models true instantaneous traffic surge.
  soak:   Sustain at 80% peak_vus for max(duration_minutes × 48, 1440) minutes.
          Memory leak detection: alert if process RSS grows > 20% over baseline after 1h.
  chaos:  Identical stages to load test; at 60s intervals inject:
            - 500ms latency on dependency calls (tc netem or service mesh fault injection)
            - 10% HTTP 503 error rate on dependency
            - 30s dependency full blackout
  Output: scenario_profiles[] { type, stages[], breaking_point?, chaos_faults[] }

Step 3 — Generate test scripts in selected tool format
  k6:
    Import { check, sleep, group } from 'k6'; import http from 'k6/http'.
    Emit options.stages[] from scenario_profiles. Emit options.thresholds{} from slo_targets.
    Use SharedArray('users', ...) for parameterized data. Auth via __ENV.AUTH_TOKEN.
    Each endpoint wrapped in group(path, fn). check(res, { 'status is 2xx': r => r.status < 300 }).
    sleep(Math.random() * 2 + 0.5)  (think time: 0.5–2.5s exponential-like distribution).
  Gatling:
    class LoadSimulation extends Simulation. httpProtocol = http.baseUrl(__ENV("BASE_URL")).
    feedFile = csv("data/users.csv").circular(). Each scenario as separate ScenarioBuilder.
    setUp(scenario.inject(rampUsers(peak_vus).during(ramp_up_s))).protocols(httpProtocol).
    assertions: global.failedRequests.percent.lt(error_rate_pct), responseTime.percentile3.lt(p99).
  Locust:
    class ApiUser(HttpUser): host = os.environ["BASE_URL"]. wait_time = between(0.5, 2.5).
    @task(weight) def endpoint_name(self): self.client.get(path, headers=auth_headers, catch_response=True).
  JMeter:
    JMX XML: TestPlan > ThreadGroup (num_threads, ramp_time, duration) > HTTPSamplerProxy.
    CSVDataSet element for parameterized data. ResponseAssertion checking HTTP 2xx.
    SummaryReport listener. BeanShell assertion for p99 threshold check.
  Output: test_scripts[] { tool, scenario_name, type, script_content, data_files[] }

Step 4 — Emit SLO threshold definitions in tool-native format
  k6:
    thresholds: {
      "http_req_duration{p(99)}": ["p(99)<{latency_p99_ms}"],
      "http_req_duration{p(95)}": ["p(95)<{latency_p95_ms}"],  # if provided
      "http_req_failed": ["rate<{error_rate_pct/100}"]
    }
  Gatling:
    global.failedRequests.percent.lt(error_rate_pct)
    global.responseTime.percentile3.lt(latency_p99_ms)  // percentile3 = p99 in Gatling
  Locust: Custom EventHook with stats.total.fail_ratio check in test_stop event handler.
  JMeter: ResponseAssertion in BeanShell PostProcessor asserting SampleResult.getTime() < p99.
  Output: slo_thresholds { tool_format, threshold_definitions, gate_exit_code_on_failure: true }

Step 5 — Design data parameterization strategy
  static:        Single static payload per endpoint. No CSV needed. Use hardcoded test user.
  parameterized: Emit CSV header row + 5 sample rows. Note that 10,000 rows are needed for full run.
                 Fields: user_id (UUID), email, session_token, request_payload (JSON-escaped).
                 Circular iteration ensures even distribution across VUs.
  generated:     Inline faker calls: faker.internet.email(), faker.datatype.uuid(), faker.lorem.word().
                 k6: import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'.
                 Locust: from faker import Faker; fake = Faker().
  Output: data_parameterization { strategy, sample_csv_header, sample_rows[], generator_snippets{} }

Step 6 — Generate CI integration job YAML
  GitHub Actions: job using grafana/k6-action@v0.3.0 (k6) or enricosecco/setup-gatling@v1.
    Steps: [checkout, setup-tool, run-test, upload-artifact: reports/].
    Threshold failure exits non-zero, failing the CI job.
    Baseline comparison: download baseline artifact, run compare_baseline.sh (p99 regression > 10% = fail).
  GitLab CI: image: grafana/k6:latest. artifacts: { paths: [reports/], reports: { performance: k6-report.json } }.
    script: k6 run --out json=k6-output.json test.js. allow_failure: false.
  Baseline comparison script: compare p99 from current k6-output.json vs baseline.json; exit 1 if >10% regression.
  Output: ci_integration { platform, job_yaml, baseline_comparison_script }

Step 7 — Compose acceptance criteria and baseline report template
  acceptance_criteria: map each slo_targets field to human-readable statement:
    "p99 response time MUST be < {latency_p99_ms}ms under {peak_vus} concurrent users"
    "Error rate MUST be < {error_rate_pct}% at target load"
    "Throughput MUST sustain >= {throughput_rps} RPS for {duration_minutes} minutes"
  baseline_report_template: { timestamp, build_id, scenario, tool, p50_ms, p95_ms, p99_ms,
                              rps_achieved, error_rate_pct, peak_vus, passed, slo_violations[] }
  Output: acceptance_criteria[], baseline_report_template
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `test_scenarios` | `array` | `{ scenario_name, type, script_template, ramp_up_s, peak_vus, duration_s }` |
| `slo_thresholds` | `object` | Tool-native threshold definitions for pass/fail gates |
| `data_parameterization` | `object` | Data strategy, CSV sample, and inline generator snippets |
| `ci_integration` | `object` | Platform-specific CI job YAML and baseline comparison script |
| `baseline_report_template` | `object` | JSON schema for tracking performance metrics across releases |
| `acceptance_criteria` | `array[string]` | Human-readable SLO pass/fail conditions |
| `metrics` | `object` | Execution metrics |
| `feedback` | `array` | Backpropagation and advisory entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["test_scenarios", "slo_thresholds", "data_parameterization", "ci_integration",
               "baseline_report_template", "acceptance_criteria", "metrics", "feedback"],
  "properties": {
    "test_scenarios": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["scenario_name", "type", "script_template", "ramp_up_s", "peak_vus", "duration_s"],
        "properties": {
          "scenario_name": { "type": "string" },
          "type": { "type": "string", "enum": ["load", "stress", "spike", "soak", "chaos"] },
          "script_template": { "type": "string" },
          "ramp_up_s": { "type": "integer" },
          "peak_vus": { "type": "integer" },
          "duration_s": { "type": "integer" }
        }
      }
    },
    "slo_thresholds": {
      "type": "object",
      "properties": {
        "tool_format": { "type": "string" },
        "threshold_definitions": { "type": "object" },
        "gate_exit_code_on_failure": { "type": "boolean" }
      },
      "required": ["tool_format", "threshold_definitions"]
    },
    "data_parameterization": {
      "type": "object",
      "properties": {
        "strategy": { "type": "string" },
        "sample_csv_header": { "type": "string" },
        "sample_rows": { "type": "array" },
        "generator_snippets": { "type": "object" }
      },
      "required": ["strategy"]
    },
    "ci_integration": {
      "type": "object",
      "properties": {
        "platform": { "type": "string" },
        "job_yaml": { "type": "string" },
        "baseline_comparison_script": { "type": "string" }
      },
      "required": ["job_yaml"]
    },
    "baseline_report_template": { "type": "object" },
    "acceptance_criteria": { "type": "array", "items": { "type": "string" } },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in": { "type": "integer" },
        "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "scenarios_generated": { "type": "integer" },
        "endpoints_covered": { "type": "integer" },
        "version": { "type": "string" }
      },
      "required": ["tokens_in", "tokens_out", "duration_ms", "scenarios_generated", "version"]
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

- VU counts MUST be derived from Little's Law using `latency_p99_ms` — hardcoded VU counts are not permitted.
- Soak test duration floor is 60 minutes; if `duration_minutes < 60` and soak is requested, override to 60 and emit a warning.
- Spike test MUST model instantaneous load change (zero ramp time) — this is the defining characteristic of a spike test vs. a load test.
- Stress test MUST include an automatic circuit-breaker condition: halt load increase when error rate > 10% for 30 consecutive seconds.
- All test scripts MUST inject `BASE_URL` and `AUTH_TOKEN` via environment variables only — no inline values.
- CSV data files exceeding 10,000 rows require external provisioning; the skill emits a note but does not embed large files in output.
- CI integration jobs MUST exit non-zero on SLO threshold breach to block pipeline promotion.
- Chaos load scenarios MUST document the specific fault injection tool and parameters (tc netem, Istio VirtualService fault, etc.).

## Security Considerations

- `AUTH_TOKEN` must always be injected via `__ENV.AUTH_TOKEN` (k6), `__ENV("AUTH_TOKEN")` (Gatling), or `os.environ["AUTH_TOKEN"]` (Locust) — never hardcoded.
- Test data CSV files must use synthetic identifiers only (UUID, faker-generated emails) — no real PII is permitted in test data.
- Load test targets in CI must point to isolated staging environments, never production endpoints.
- JMeter JMX files must not embed credentials in `HTTPSamplerProxy` auth fields — use JMeter Properties file injection.

## Token Optimization

- Pass `payload_schema` only for POST/PUT/PATCH endpoints — omit for GET/DELETE to reduce input token count.
- Return `script_template` as abbreviated templates with `{{PLACEHOLDER}}` markers; full scripts are written to state files, not returned inline.
- Emit one `test_scenarios` entry per test type, not per endpoint — the script template covers all endpoints internally using a loop or group.

## Quality Checklist

- [ ] VU counts for every scenario derived from Little's Law using `latency_p99_ms`
- [ ] All five test types produce structurally distinct, non-identical stage profiles
- [ ] SLO thresholds emitted in tool-native format and match the exact values from `slo_targets`
- [ ] Data parameterization output matches the declared `test_data_strategy`
- [ ] CI job YAML includes non-zero exit code on threshold failure
- [ ] Soak test duration is >= 60 minutes with override warning if input was lower
- [ ] All environment-sensitive values (BASE_URL, AUTH_TOKEN) use env-var references throughout
- [ ] Acceptance criteria list is human-readable and maps 1:1 to each `slo_targets` field

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `soak` requested with `duration_minutes < 60` | Override to 60 minutes; emit `warning` in feedback noting the override |
| `chaos` type requested but no dependency info in context | Generate chaos scenario with generic HTTP 503 error injection; emit `backpropagate` to architecture-design |
| All `expected_rps` values < 1 | Emit `warning`: targets appear very low; proceed with minimum 1 VU scenarios per endpoint |
| `tool=jmeter` with no JDK environment specified | Emit `info`: JMeter requires JDK 11+ at runtime; proceed with JMX generation |
| `slo_targets` missing `latency_p95_ms` or `latency_p50_ms` | Derive: p95 = p99 × 0.7, p50 = p99 × 0.3; emit `info` noting derivation |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Soak test > 8 hours | Computed soak duration exceeds 480 minutes | 3600s | Pause for human approval of extended schedule due to CI resource cost |
| Stress test peak VUs > 10,000 | Calculated peak exceeds 10,000 VUs | 1800s | Warn of infrastructure cost and potential unintentional DDoS; require explicit human confirmation |

## 13. Skill Composition

```yaml
composes_with:
  - skill: testing-strategy
    role: upstream
    note: "testing-strategy defines which test types are required; load-test-designer implements them"
  - skill: slo-sla-designer
    role: upstream
    note: "slo-sla-designer produces slo_targets values consumed by this skill"
  - skill: performance-guard
    role: downstream
    note: "performance-guard uses baseline_report_template output to detect p99 regressions pre-release"
  - skill: ci-pipeline-generator
    role: downstream
    note: "ci_integration.job_yaml is consumed to embed load tests into the full CI pipeline"

input_from_state:
  - scope: slo_sla_designer
    field: slo_targets
    maps_to: slo_targets
  - scope: architecture
    field: services[*].api.endpoints
    maps_to: endpoints (inferred from architecture if not provided directly)

emits_events:
  - load_test.designed
  - load_test.soak.long_duration_flagged
```

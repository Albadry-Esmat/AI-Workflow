# Observability — Knowledge Reference

## Principles

- **Metrics as first-class output**: Every skill execution produces a `metrics` block — not as an afterthought, but as a required output field. If a skill cannot measure its execution, its quality cannot be assessed.
- **Trace, don't log**: Prefer structured trace data (skill_id, duration_ms, tokens_in, tokens_out, items_produced) over free-text logs. Traces are queryable; logs are not.
- **Pipeline-level aggregation**: Individual skill metrics are useful for debugging; pipeline-level aggregates (total tokens, total duration, bottleneck skills) drive optimization decisions.
- **No silent failures**: Every failure path emits a measurable signal. An unobserved failure is indistinguishable from success.
- **Feedback loop closure**: Metrics feed the quality-scoring skill, which feeds the skill evolution decision. The loop is: observe → score → evolve.

## Metrics Schema (per-skill)

```json
{
  "tokens_in": "integer — input token count for this invocation",
  "tokens_out": "integer — output token count for this invocation",
  "duration_ms": "integer — wall-clock execution time",
  "items_produced": "integer — number of primary output items (requirements, modules, tests, etc.)",
  "version": "string — skill version that produced this output",
  "retry_count": "integer — number of retries before success (0 = first attempt succeeded)",
  "cache_hit": "boolean — true if output was served from prior validated result"
}
```

## Pipeline Aggregation

The orchestrator aggregates per-skill metrics into a pipeline report after each execution:

| Metric | Computation |
|--------|------------|
| `total_tokens` | Sum of all skills' `tokens_in + tokens_out` |
| `pipeline_duration_ms` | Wall-clock from first skill start to last skill end |
| `bottleneck_skill` | Skill with highest `duration_ms` |
| `token_efficiency` | `items_produced / total_tokens` (higher = more efficient) |
| `retry_rate` | Skills with `retry_count > 0` / total skills |
| `budget_utilization` | `total_tokens / budget_tier.max_tokens` |

## Alerting Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Token overage | `total_tokens > budget_tier * 0.9` | Trigger context-compressor |
| Skill retry storm | `retry_rate > 0.3` | Pause pipeline, emit alert |
| Duration spike | `duration_ms > 60000` for any single skill | Log warning, continue |
| Zero items produced | `items_produced == 0` after retry | Reject skill output, escalate |

## Anti-patterns

- **Vanity metrics**: Measuring things that look impressive but don't drive decisions (e.g., counting total characters generated). Measure items produced and quality outcomes, not volume.
- **Metric suppression**: Omitting the `metrics` block from skill output because "this was a quick run." Every run is measured.
- **Aggregation without baseline**: Pipeline metrics are only useful relative to a baseline. Establish baselines in the first 3 pipeline runs and compare thereafter.
- **Observer effect**: Metrics collection adding measurable overhead (>5% of duration). Use async metric flushing.

## Source References

- OpenTelemetry tracing specification
- SRE metrics practices (Google SRE Book, Chapter 6)
- Agentic pipeline observability patterns

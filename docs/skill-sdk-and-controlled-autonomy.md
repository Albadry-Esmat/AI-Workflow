# Skill SDK and Controlled Autonomy

## Purpose and boundary

Batch 9 adds a local-first Skill SDK around the existing AI-Workflow catalog. The SDK makes skill creation reproducible, keeps draft work outside the live catalog, generates reviewable registry and graph diffs, and preserves the existing human approval boundary. It also provides a narrow feedback-to-evaluation path and bounded autonomy experiments. These features produce evidence and proposals; they do not create a hosted control plane, call live model providers, write to external systems, or promote autonomous behavior without explicit approval.

> **Promotion rule:** An autonomy pattern may be promoted only when it demonstrates measurable improvement against a defined baseline without violating security, budget, latency, traceability, or human-override thresholds. A report that does not prove value remains rejected or is deleted; it does not become permanent complexity.

## Skill scaffold lifecycle

The command `aiw skill create` generates a draft package under `artifacts/skill-scaffolds/<skill-name>/`. The generator validates its manifest against `config/skill-scaffold-schema.json` and uses the fail-closed values in `config/skill-sdk-policy.json`. Creation never edits `.opencode/skills`, `skills/index.yaml`, `skills/registry.json`, or `skills/graph/skill-graph.yaml`.

| Scaffold artifact | Purpose |
|---|---|
| `SKILL.md` | Draft skill body with the twelve repository-required sections and version frontmatter |
| `skill-manifest.json` | Name, version, domain, layer, maturity, ownership, security, cost, lifecycle, and registration policy |
| `contract-tests/contract.json` | Placeholder input/output contract that must be completed before registration |
| `eval-fixtures/index.json` | Placeholder evaluation suite that must be completed and approved before promotion |

The explicit `aiw skill apply --scaffold <path> --apply --approved-by <actor>` command is the only new path that mutates the live catalog. Before changing files, it creates an ignored backup under `artifacts/skill-apply-backups/`. It allocates the next unused `SKL-NNN` identifier, copies the draft skill, appends a catalog entry, appends a graph node, increments the catalog version and graph node count, and runs `scripts/validate-skills.sh`. Any failure restores the backed-up canonical files and removes the copied skill directory.

## Registry and graph automation

Registry and graph updates are generated from the same approved scaffold manifest. The application path never edits the website mirror directly. The canonical files remain `skills/index.yaml`, `skills/registry.json`, and `skills/graph/skill-graph.yaml`; the existing synchronization workflow subsequently mirrors these files to ASE-OS-Website/Dev.

The graph generator follows the existing graph contract: node IDs use `SKL-NNN`, skill names are lowercase hyphenated, graph status is `experimental` for a new draft, no edge is invented without an explicit dependency declaration, and the existing validator continues to enforce node-count parity, version consistency, no cycles, no self-loops, no duplicate edges, and layer-aware dependency direction.

## Governed metadata

Newly scaffolded and applied registry entries carry the `skill_metadata` block. Legacy entries remain valid without it so Batch 9 does not force an unsafe bulk migration. The metadata schema requires the fields below.

| Field | Meaning | Safety rule |
|---|---|---|
| `ownership` | Team, maintainer, reviewers, and last review timestamp | At least one reviewer is required |
| `maturity` | Experimental, draft, established, mature, deprecated, or retired | Draft and experimental entries are not routable as promoted skills |
| `eval_score` | Score from 0 to 100 or null before evaluation | A schema-valid skill is not treated as semantically correct |
| `security_class` | Low, medium, high, or critical | High and critical behavior remains approval-gated |
| `cost` | Budget profile and estimated tokens/USD | Cost is evidence, not an authorization bypass |
| `deprecation` | Replacement, message, sunset, and approver | Deprecation requires a replacement and explicit approval |

The lifecycle remains `draft → active → deprecated → retired`. Consolidation analysis can recommend a transition but never applies it.

## Feedback-to-evaluation ingestion

`aiw feedback-to-eval --input <sanitized.jsonl>` accepts only structured metadata: feedback ID, skill name, source, short task summary, expected properties, and sensitivity class. Raw prompts, credentials, URLs, email addresses, and arbitrary content fields are rejected. Each record receives a deterministic SHA-256 deduplication key.

Records are `pending` by default and remain outside the active evaluation corpus. A human may approve selected IDs with `--approve <feedback-id> --approved-by <actor>`. Only approved records become cases under `evals/feedback-derived/cases/`; duplicate, rejected, invalid, and pending records are blocked from active use. Approved cases are read-only fixtures with `external_writes_allowed: false` and retain the approval actor and timestamp.

## Controlled autonomy experiments

`aiw autonomy-experiments` runs four bounded fixture patterns: routing, parallel review, evaluator-optimizer, and planner-executor-critic. Every report includes a baseline, experiment metrics, primary-metric delta, threshold result, security/budget/latency/traceability/override risk assessment, stop condition, rollback path, approval state, and `external_writes: 0`.

The experiment fixture uses a maximum duration of 120 minutes, bounded task counts, and cost and latency thresholds of at most 1.25 times the baseline. A report can show measurable improvement while still remaining unpromoted. The optional `--approve --approved-by <actor>` records explicit approval in the report, but does not deploy a router, change a pipeline, modify a skill, or create an always-on process. Deleting the ignored report and any promotion flag is the tested rollback path.

## Consolidation and deprecation analysis

`aiw consolidation-analysis` reads overlap fixtures and produces approval-gated recommendations. Similarity above the configured threshold creates a recommendation, while unrelated candidates are retained. A deprecation recommendation must include a replacement, rationale, deprecation message, and the configured retention period of two major versions. The analyzer writes only an ignored report and explicitly records `registry_mutated: false`.

## Validation and developer commands

The Batch 9 master control validator is `python3 scripts/validate-batch9-controls.py`, also available as `make validate-batch9` and `aiw validate-batch9`. The full validation suite includes this target through `make validate`. The focused commands are shown below.

| Command | Behavior |
|---|---|
| `aiw skill create --name ... --domain ... --description ...` | Create a draft package without registration |
| `aiw skill apply --scaffold ...` | Print a reviewable apply plan without mutation |
| `aiw skill apply --scaffold ... --apply --approved-by ...` | Apply, validate, and rollback on failure |
| `aiw feedback-to-eval --input ...` | Ingest sanitized pending feedback |
| `aiw autonomy-experiments` | Run all four bounded dry-run experiments |
| `aiw consolidation-analysis` | Produce recommendation-only overlap analysis |
| `aiw validate-batch9` | Run the Batch 9 control suite |

## Deliberate exclusions and follow-ups

Batch 9 does not provide automatic production adaptation, provider-side quality measurement, hosted experiment telemetry, external feedback connectors, dynamic policy enforcement at every MCP boundary, automatic registry commits, or automatic skill retirement. These remain follow-up work only if a later batch is explicitly approved and the required enforcement boundary is available.

## References

[1]: ../AI-Workflow-Gated-Batch-Implementation-Plan.md "Authoritative gated batch plan"

[2]: adr/ADR-0001-execution-boundary.md "Execution boundary and enforcement limits"

[3]: adr/ADR-0002-canonical-data-ownership.md "Canonical and derived data ownership"

[4]: adr/ADR-0004-risk-and-approval-tiers.md "Risk classes and approval tiers"

[5]: ../config/skill-sdk-policy.json "Batch 9 fail-closed policy"

[6]: ../config/skill-metadata-schema.json "Batch 9 skill metadata schema"

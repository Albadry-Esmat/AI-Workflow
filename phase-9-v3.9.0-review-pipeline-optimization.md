# Phase 9 — v3.9.0: Review Pipeline Optimization & Role Specialization

**Version target:** v3.9.0  
**Story points:** 89  
**Tasks:** TASK-0071 – TASK-0080  
**Category:** Pipeline architecture, token economics, governance streamlining, implementation safety  
**Depends on:** Phase 8 complete (v3.1.0)  
**Breaking changes:** Yes — orchestrator v2.1.0 → v3.0.0 (planner interface, review dispatch, gate configuration)  
**Rollback:** Feature-flagged; set `pipeline_mode: "legacy_dual_planner"` to revert to v3.8.x behaviour  

---

## Goals

Phase 9 restructures the planning and review pipeline based on findings from the v3.9.0
architecture review. The current dual-planner + multi-debate design over-indexes on consensus
(agreement) rather than correctness (objective validation). This phase replaces
agreement-based quality gates with role-specialized, evidence-based review stages while
preserving governance and traceability.

**Core thesis:** Agreement between two agents ≠ correctness. A single planner held
accountable by specialized, evidence-producing reviewers with deterministic pass/fail gates
produces higher quality at lower cost.

**Expected aggregate savings:** 35–55% reduction in planning-phase token spend; 70% reduction
in HITL approval latency; measurably higher defect detection rate via specialized review.

---

## Tasks

| ID | Title | SP | Status |
|----|-------|----|--------|
| TASK-0071 | Single planner + reviewer dispatch architecture | 13 | planned |
| TASK-0072 | Reviewer output schema & no-plan-generation guardrail | 8 | planned |
| TASK-0073 | Objective validation checklist engine | 11 | planned |
| TASK-0074 | Conditional debate trigger logic | 8 | planned |
| TASK-0075 | Pipeline reorder — research before review | 8 | planned |
| TASK-0076 | Implementation contract freeze mechanism | 13 | planned |
| TASK-0077 | Change request workflow | 11 | planned |
| TASK-0078 | HITL gate reduction (18 → 4 mandatory) | 5 | planned |
| TASK-0079 | Section-level confidence reporting | 5 | planned |
| TASK-0080 | Decision log schema & storage | 7 | planned |

---

## Task Details

### TASK-0071 — Single Planner + Specialized Reviewers (13 SP)

#### Problem
Two independent planners consume 2× planning tokens and may converge on the same incorrect
design. Consensus measures agreement, not correctness. In production telemetry (v3.8.x),
dual planners agreed 94% of the time — meaning the second planner added cost without
catching errors.

#### Change to `orchestrator` (v2.1.0 → v3.0.0):

New input: `pipeline_mode` (`"specialized_review"` | `"legacy_dual_planner"`, default `"specialized_review"`)

Remove **Step 4** (second planner invocation) and **Step 5** (consensus scoring).

Replace with new **Step 4: Reviewer Dispatch**:
```
[TASK-0071] Step 4: Reviewer Dispatch
  IF pipeline_mode == "specialized_review":
    Dispatch plan to specialized reviewers IN PARALLEL:
      - architecture-reviewer (SKILL: architecture-reviewer.md)
      - security-reviewer (SKILL: security-reviewer.md)
      - performance-reviewer (SKILL: performance-reviewer.md)
      - maintainability-reviewer (SKILL: maintainability-reviewer.md)
    Each reviewer receives:
      - The frozen plan draft (read-only)
      - The requirements document
      - The research outputs (if any)
    Each reviewer produces: ReviewFinding[] (see TASK-0072 schema)
    Aggregate all findings into review_report artifact.
    Pass review_report to Planner for revision (Step 5).
  ELSE:
    Fall back to legacy dual-planner + consensus (v3.8.x behaviour).
```

#### Reviewer Roles

| Reviewer | Focus Areas | Typical Token Budget |
|----------|-------------|---------------------|
| Architecture | Component boundaries, dependency graph, API surface, modularity | 2 000–4 000 |
| Security | Auth flows, data classification, threat vectors, secrets handling | 1 500–3 000 |
| Performance | Latency paths, N+1 queries, resource bounds, caching strategy | 1 500–3 000 |
| Maintainability | Test coverage strategy, coupling, naming, documentation gaps | 1 500–2 500 |

#### Constraint
Reviewers MUST NOT generate replacement plans. Only the Planner edits the plan. If a reviewer
produces a `proposed_plan` field, the orchestrator MUST strip it and log a guardrail violation.

#### Acceptance Criteria
- [ ] Dual-planner path removed from default flow
- [ ] Four reviewer skills created with SKILL.md definitions
- [ ] Reviewers execute in parallel (wall-clock time = slowest reviewer)
- [ ] Legacy mode available via feature flag
- [ ] Token spend on planning phase reduced ≥ 30% in benchmark suite

#### Rollback
Set `pipeline_mode: "legacy_dual_planner"` — no data migration required.

---

---

### TASK-0072 — Reviewer Output Schema & Guardrail (8 SP)

#### Problem
Without a strict schema, reviewers produce free-form text that is hard to aggregate, prioritize,
or programmatically validate.

#### Change

Define `ReviewFinding` schema (JSON Schema + YAML representation):
```yaml
ReviewFinding:
  type: object
  required: [id, issue, severity, evidence, recommendation, section, reviewer]
  properties:
    id:
      type: string
      pattern: "^RF-[0-9]{4}$"
    issue:
      type: string
      maxLength: 200
    severity:
      enum: [critical, high, medium, low]
    evidence:
      type: string
      description: "Concrete reference to plan section, requirement, or external source"
    recommendation:
      type: string
      maxLength: 500
    section:
      type: string
      description: "ID of the plan section this finding applies to"
    reviewer:
      enum: [architecture, security, performance, maintainability]
    proposed_plan:
      not: {}   # FORBIDDEN — guardrail: reviewers must not produce plans
```

**Guardrail enforcement** (new orchestrator validation step):
```
[TASK-0072] Step 4b: Validate reviewer outputs
  FOR EACH reviewer_response:
    Validate against ReviewFinding[] schema.
    IF response contains ANY field matching plan-generation heuristics
      (keys: "implementation", "code", "full_plan", "revised_plan"):
      Log guardrail_violation event.
      Strip offending fields.
      Append meta-finding: "Reviewer overstepped scope — output truncated."
    Deduplicate findings by (section, issue) — keep highest severity.
    Sort by severity DESC.
```

#### Acceptance Criteria
- [ ] JSON Schema published at `skills/schema/review-finding.schema.json`
- [ ] Orchestrator validates all reviewer outputs against schema before forwarding
- [ ] Guardrail violation logged and stripped (never reaches planner as a plan)
- [ ] Deduplication logic verified with ≥ 3 test cases

---

### TASK-0073 — Objective Validation Checklist Engine (11 SP)

#### Problem
A consensus score (e.g., 0.80) is a proxy metric. High agreement among flawed agents is still
failure. The metric is continuous and subjective — no clear threshold for "good enough."

#### Change

Replace consensus scoring with a deterministic **validation engine** that runs AFTER planner
revision (Step 6):

```
[TASK-0073] Step 6: Objective Validation
  Run validation_checklist against revised plan:
    ┌─────────────────────────────────────────────────────────┬────────┐
    │ Check                                                   │ Type   │
    ├─────────────────────────────────────────────────────────┼────────┤
    │ Requirements coverage = 100%                            │ hard   │
    │ All components have interface definition                │ hard   │
    │ All dependencies resolvable (registry lookup)           │ hard   │
    │ No open critical/high security findings                 │ hard   │
    │ Every component has test strategy                       │ hard   │
    │ Rollback strategy defined                               │ hard   │
    │ Traceability: every req → implementation path           │ hard   │
    │ Performance budget defined for latency-critical paths   │ soft   │
    │ Documentation coverage ≥ 80%                            │ soft   │
    │ No medium findings older than 1 revision cycle          │ soft   │
    └─────────────────────────────────────────────────────────┴────────┘

  IF ANY hard check fails:
    Plan status = REJECTED
    Return to Planner with failing checks as input
    Increment revision_count; IF revision_count > max_revisions (default 3):
      Escalate to HITL with full context
  IF ALL hard checks pass AND ≥ 7/10 total pass:
    Plan status = APPROVED
  ELSE:
    Plan status = CONDITIONALLY_APPROVED (soft failures logged as tech debt)
```

New output: `validation_report` artifact with per-check pass/fail + evidence.

#### Acceptance Criteria
- [ ] Validation engine executes deterministically (no LLM call — pure logic)
- [ ] Hard-fail on any critical gate
- [ ] Escalation path after max revisions
- [ ] Validation report stored as session artifact
- [ ] Consensus score removed from default pipeline output

---

### TASK-0074 — Conditional Debate Trigger Logic (8 SP)

#### Problem
Three mandatory debate phases (requirements, architecture, planning) add latency and cost
even when all reviewers agree. Telemetry shows 78% of debates conclude with no change.

#### Change

New **Step 4c: Debate Decision**:
```
[TASK-0074] Step 4c: Evaluate debate necessity
  debate_triggers = []
  FOR EACH section IN plan:
    section_findings = filter(review_report, section=section.id)
    section_confidence = min(reviewer_confidences for this section)

    IF section_confidence < debate_threshold (default 0.7):
      debate_triggers.append({section, reason: "low_confidence"})
    ELIF count_distinct_reviewers_with_findings(section) >= 2
         AND findings_contradict(section_findings):
      debate_triggers.append({section, reason: "reviewer_disagreement"})
    ELIF any(f.severity == "critical" AND f.recommendation == "unclear", section_findings):
      debate_triggers.append({section, reason: "unresolved_critical"})

  IF debate_triggers:
    Invoke debate-skill ONLY for triggered sections (scoped debate).
    Pass: section content, conflicting findings, research context.
    Debate output → Planner for targeted revision.
  ELSE:
    Skip debate entirely. Proceed to Planner revision.
    Log: "debate_skipped: all_sections_clear"
```

New config: `debate_threshold` (float, 0.0–1.0, default 0.7)  
New config: `debate_max_rounds` (int, default 2)

#### Expected Impact
- 60–80% of sessions skip debate entirely
- Remaining debates are scoped (single section) — 3–5× fewer tokens than full-plan debate

#### Acceptance Criteria
- [ ] Debate triggers fire correctly on synthetic low-confidence scenario
- [ ] Debate triggers fire on contradictory reviewer findings
- [ ] Debate is skipped when all sections pass threshold
- [ ] Scoped debate passes only relevant section context (not full plan)
- [ ] `debate_skipped` event emitted to telemetry

---

### TASK-0075 — Pipeline Reorder: Research Before Review (8 SP)

#### Problem
Research currently occurs after review. Reviewers evaluate plans containing unverified
assumptions (e.g., "this library supports X" or "API rate limit is Y"). This wastes reviewer
tokens on issues that research would have resolved.

#### Change

Move Research Agent invocation from Step 7 (post-review) to **Step 3b** (post-planner-draft):

```
[TASK-0075] Revised pipeline order:
  Step 1: Requirements Validation
  Step 2: Planner Draft
  Step 3: Research Agent (CONDITIONAL)
    Triggered when planner flags:
      - uncertainty_markers: ["unverified", "assumption", "needs_research", "TBD"]
      - external_dependency_count > 0 (new deps not in project lockfile)
    Research resolves:
      - API capability verification
      - Library compatibility checks
      - Performance benchmark lookup
      - License compatibility
    Research output appended to plan as `research_appendix` artifact.
  Step 4: Reviewer Dispatch (receives plan + research appendix)
  Step 5: Planner Revision
  Step 6: Validation
  Step 7: Freeze
```

#### Acceptance Criteria
- [ ] Research triggers on planner uncertainty markers
- [ ] Research output available to reviewers as context
- [ ] No research invocation when planner flags zero uncertainties
- [ ] Research findings cited in reviewer evidence fields

---

### TASK-0076 — Implementation Contract Freeze (13 SP)

#### Problem
Approved plans can drift during implementation. Implementation agents may deviate without
detection — especially across long sessions or multi-agent handoffs.

#### Change

New **Step 7: Contract Freeze**:
```
[TASK-0076] Step 7: Freeze Implementation Contract
  Generate contract:
    contract_id: uuid_v4()
    version: 1
    plan_hash: sha256(canonical_plan_json)
    approved_by: final_verifier_id
    approved_at: now_iso8601()
    approved_via: validation_report.id
    sections:
      FOR EACH section IN approved_plan:
        { id, title, content_hash: sha256(section.content), confidence }
    implementation_rules:
      - "MUST implement all sections as specified"
      - "MUST NOT add scope not in contract"
      - "MUST raise change_request for any deviation"
      - "MUST reference contract_id in all implementation artifacts"
    expiry: now + 72h (re-validation required if implementation not started)
    change_requests: []

  Store contract as immutable artifact (append-only log).
  Emit contract_frozen event.
  Pass contract_id to implementation agents as binding reference.
```

**Implementation agent pre-flight check** (added to all implementation skills):
```
Before generating any code:
  Load contract by contract_id.
  Verify contract.expiry > now.
  Verify current_section in contract.sections.
  IF section.content_hash != expected:
    ABORT with "contract_integrity_violation"
```

#### Acceptance Criteria
- [ ] Contract generated with SHA-256 content hashes
- [ ] Contract stored as immutable session artifact
- [ ] Implementation agents validate contract before execution
- [ ] Expired contracts trigger re-validation flow
- [ ] Contract version incremented on change request approval

---

### TASK-0077 — Change Request Workflow (11 SP)

#### Problem
When implementation discovers the approved plan is incorrect or incomplete, there is no
formal path to amend it. Current options: restart the entire pipeline (expensive) or silently
deviate (dangerous).

#### Change

New skill: `change-request-handler.md`

```
[TASK-0077] Change Request Flow:
  Implementation agent detects issue:
    - Missing requirement discovered during coding
    - External API behaves differently than researched
    - Performance constraint impossible with chosen approach

  Agent invokes change_request:
    {
      contract_id: string,
      affected_sections: [section_id],
      reason: string (max 500 chars),
      evidence: string (concrete observation),
      proposed_change: string (what should change),
      impact_assessment: {
        scope: "isolated" | "cross-cutting",
        estimated_rework: "none" | "minor" | "significant",
        blocks_other_sections: boolean
      }
    }

  Orchestrator response:
    1. Pause ONLY affected work streams (others continue)
    2. Route to targeted reviewers (only reviewers relevant to affected sections)
    3. Planner evaluates and amends contract
    4. New contract version issued (version N+1)
    5. Emit change_request_approved | change_request_rejected event
    6. Resume paused work streams with updated contract

  Guardrails:
    - Max 3 change requests per contract (4th triggers full re-plan)
    - Change requests MUST include evidence (not opinions)
    - Cross-cutting changes require HITL approval
```

#### Acceptance Criteria
- [ ] Change request schema validated on submission
- [ ] Targeted re-review (not full pipeline restart)
- [ ] Contract version incremented correctly
- [ ] Paused work streams resume automatically after approval
- [ ] Max change request limit enforced with escalation

---

### TASK-0078 — HITL Gate Reduction (5 SP)

#### Problem
18 human-approval gates cause approval fatigue. Studies show human reviewers rubber-stamp
after gate #5. The current design creates a false sense of governance while degrading
throughput.

#### Change

New config: `hitl_gates` in orchestrator configuration:

```yaml
hitl_gates:
  mandatory:
    - id: requirements_signoff
      trigger: after_step_1
      description: "Human confirms requirements are correct and complete"
    - id: architecture_approval
      trigger: after_step_4  # after reviewer findings aggregated
      description: "Human approves architectural direction"
      condition: "any(finding.severity == 'critical')"  # skip if no critical findings
    - id: final_plan_approval
      trigger: after_step_7  # after contract freeze
      description: "Human signs off on frozen implementation contract"
    - id: production_deployment
      trigger: before_deploy
      description: "Human authorizes production release"

  conditional:
    - id: security_escalation
      trigger: when security_reviewer finds critical
      description: "Security critical finding requires human decision"
    - id: budget_exceeded
      trigger: when estimated_tokens > budget_limit
      description: "Token budget exceeded — human decides whether to continue"
    - id: change_request_crosscutting
      trigger: when change_request.impact_assessment.scope == "cross-cutting"
      description: "Cross-cutting change requires human approval"
    - id: max_revisions_reached
      trigger: when revision_count > max_revisions
      description: "Plan failed validation too many times"
```

#### Acceptance Criteria
- [ ] Default config has 4 mandatory gates
- [ ] Conditional gates trigger only on specified conditions
- [ ] Legacy 18-gate config available as `hitl_preset: "full"`
- [ ] Gate skip logged with reason for audit trail

---

### TASK-0079 — Section-Level Confidence Reporting (5 SP)

#### Problem
A single aggregate confidence score (e.g., 0.87) hides weak sections. A plan with 95%
confidence overall may have a 0.4 confidence auth section that causes a production incident.

#### Change

After reviewer dispatch, compute per-section confidence:
```
[TASK-0079] Section Confidence Computation:
  FOR EACH section IN plan:
    findings = filter(review_report, section=section.id)
    base_confidence = 1.0
    FOR EACH finding IN findings:
      penalty = {critical: 0.3, high: 0.15, medium: 0.05, low: 0.02}[finding.severity]
      base_confidence -= penalty
    section.confidence = max(0.0, base_confidence)
    section.confidence_factors = findings.map(f => {f.id, f.severity, f.issue})

  Plan-level confidence = min(section_confidences)  # weakest link
  Flag sections with confidence < 0.7 as "needs_attention"
```

Output in validation report:
```yaml
section_confidence:
  - id: auth-design
    confidence: 0.55
    status: needs_attention
    factors:
      - RF-0012: "No token refresh strategy" (high)
      - RF-0015: "Missing rate limiting" (high)
  - id: data-model
    confidence: 0.95
    status: healthy
  - id: api-layer
    confidence: 0.80
    status: acceptable
```

#### Acceptance Criteria
- [ ] Per-section confidence computed deterministically from findings
- [ ] Low-confidence sections flagged in validation report
- [ ] Plan-level confidence = weakest section (not average)
- [ ] Confidence feeds into debate trigger logic (TASK-0074)

---

### TASK-0080 — Decision Log Schema & Storage (7 SP)

#### Problem
Significant architectural decisions made during planning are not recorded. Future maintainers
cannot understand WHY a choice was made, only WHAT was chosen.

#### Change

New artifact type: `decision_log`

```yaml
DecisionEntry:
  type: object
  required: [id, context, options, decision, trade_offs, decided_by, decided_at]
  properties:
    id:
      type: string
      pattern: "^DEC-[0-9]{4}$"
    context:
      type: string
      description: "What question needed answering"
    options:
      type: array
      items:
        type: object
        properties:
          name: { type: string }
          pros: { type: array, items: { type: string } }
          cons: { type: array, items: { type: string } }
    decision:
      type: string
      description: "Which option was chosen"
    trade_offs:
      type: string
      description: "What we gave up and why it's acceptable"
    evidence:
      type: string
      description: "Data supporting the decision (benchmarks, research, precedent)"
    decided_by:
      enum: [planner, human, debate]
    decided_at:
      type: string
      format: date-time
    supersedes:
      type: string
      description: "ID of decision this replaces (for change requests)"
```

**Planner instruction** (appended to planner SKILL.md):
```
When you choose between alternatives during planning:
  Record a DecisionEntry in the decision_log artifact.
  ALWAYS include at least 2 options with pros/cons.
  ALWAYS cite evidence (research output, benchmark, or stated requirement).
  Do NOT record trivial choices (naming conventions, formatting).
  Record choices about: technology, architecture patterns, data stores,
  communication protocols, security mechanisms, deployment strategies.
```

#### Acceptance Criteria
- [ ] Decision log schema published at `skills/schema/decision-entry.schema.json`
- [ ] Planner produces decision entries for significant choices
- [ ] Decision log stored as session artifact
- [ ] Change requests reference `supersedes` field when overriding prior decisions
- [ ] Decision log queryable by section_id

---

## Migration Guide

### From v3.8.x to v3.9.0

1. **No action required for default upgrade** — `pipeline_mode: "specialized_review"` is the
   new default. The dual-planner path is preserved behind `pipeline_mode: "legacy_dual_planner"`.

2. **HITL gate configuration** — Existing 18-gate configurations will continue to work with
   `hitl_preset: "full"`. New installations default to 4 mandatory gates.

3. **New skills to deploy:**
   - `skills/pipelines/architecture-reviewer.md`
   - `skills/pipelines/security-reviewer.md`
   - `skills/pipelines/performance-reviewer.md`
   - `skills/pipelines/maintainability-reviewer.md`
   - `skills/pipelines/change-request-handler.md`

4. **New schemas:**
   - `skills/schema/review-finding.schema.json`
   - `skills/schema/decision-entry.schema.json`
   - `skills/schema/implementation-contract.schema.json`
   - `skills/schema/change-request.schema.json`

5. **Telemetry events added:**
   - `debate_skipped`, `debate_triggered`
   - `contract_frozen`, `contract_expired`
   - `change_request_created`, `change_request_approved`, `change_request_rejected`
   - `guardrail_violation`
   - `validation_passed`, `validation_failed`

---

## Success Metrics

| Metric | Measurement | Target |
|--------|-------------|--------|
| Planning token spend | Before/after on benchmark suite (20 tasks) | ≥ 35% reduction |
| Defect escape rate | Issues found in implementation that reviewers missed | ≤ 5% (from ~15%) |
| Time to approved plan | Wall-clock seconds from requirements to freeze | ≤ 60s median |
| HITL approval latency | Human wait time per session | ≥ 70% reduction |
| Debate frequency | % of sessions invoking debate | ≤ 30% (from 100%) |
| Change request rate | % of contracts requiring amendment | ≤ 15% |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Single planner has blind spots | Medium | High | 4 specialized reviewers catch different classes of issues |
| Reviewers produce low-quality findings | Medium | Medium | Schema validation + guardrails + finding deduplication |
| Debate threshold too high (misses real issues) | Low | High | Tunable threshold + telemetry monitoring |
| Contract freeze too rigid for exploratory work | Medium | Medium | 72h expiry + change request path + configurable strictness |
| HITL reduction misses critical issues | Low | Critical | Conditional gates fire on severity; mandatory gates unchanged |

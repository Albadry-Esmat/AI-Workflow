# FEATURE-015 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Register Operation Persists to State
- Given a `register` operation with a valid `primary_repo` (name: "payments-lib", type: "library", current_version: "2.1.0") and a `repo_registry` array of 3 consuming service repos
- When multi-repo-coordinator executes
- Then the cross-repo registry in state-manager contains the payments-lib entry with its 3 consumers
- And `cross_repo_registry` in the output reflects the updated state with `last_updated` timestamps

### AC-2: Cross-Repo Impact Analysis Identifies All Consumers
- Given an `analyze-impact` operation where payments-lib removes the `processRefund()` interface
- When multi-repo-coordinator evaluates the consumer graph
- Then `impact_report.affected_repos` lists every repo that declared payments-lib as a dependency
- And each affected repo entry includes `impact_severity: "critical"` (interface removed) and `affected_interfaces: ["processRefund()"]`

### AC-3: Circular Dependency Detection and Escalation
- Given an `analyze-impact` operation where repo-A depends on repo-B and repo-B depends on repo-A
- When the consumer graph DFS cycle detection runs
- Then `circular_cross_repo_dependency_detected` feedback is emitted with `type: "backpropagate"`
- And the `evidence` field includes the full cycle path `["repo-A", "repo-B", "repo-A"]`

### AC-4: Topologically Safe Migration Plan
- Given a non-circular consumer graph with repos: api-gateway (no consumers), order-service (consumes api-gateway), checkout-service (consumes api-gateway + order-service)
- When `analyze-impact` completes
- Then `migration_coordination_plan.update_sequence` is `["api-gateway", "order-service", "checkout-service"]`
- And the rationale explains that repos with no upstream consumers are updated first

### AC-5: Synchronized Work Items Generated Per Repo
- Given a `sync-work-items` operation with an `impact_report` listing 3 affected repos
- When multi-repo-coordinator executes
- Then `synchronized_work_items` contains exactly 3 stubs — one per affected repo
- And each stub's `cross_ref_link` references the primary change identifier of the primary_repo

### AC-6: HITL Gate Triggers for Critical Impact
- Given an `analyze-impact` result where `impact_report.risk_level == "critical"` (an interface was removed)
- When the skill completes its evaluation
- Then a `backpropagate` feedback entry is emitted with `target_skill: "orchestrator"`
- And the orchestrator pauses the pipeline presenting `impact_report` to the human before sync-work-items proceeds

---

## Definition of Done (DoD)

- [ ] `.opencode/skills/multi-repo-coordinator/SKILL.md` (SKL-075) created — all 13 sections complete
- [ ] `skills/registry.json` updated — SKL-075 registered with `status: draft`
- [ ] `skills/index.yaml` updated — index entry for multi-repo-coordinator added
- [ ] Cross-repo registry persisted and retrieved correctly via state-manager
- [ ] Impact severity matrix (§3 of plan.md) correctly applied in analyze-impact
- [ ] Kahn's topological sort verified on a 5-node consumer graph
- [ ] All 6 acceptance criteria above verified
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] `status.md` `Status` set to `implemented` upon completion

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F015-T1 | Author `multi-repo-coordinator/SKILL.md` — all 13 sections | new skill | 3.0 |
| F015-T2 | Implement register + query operations with state-manager persistence | skill | 2.0 |
| F015-T3 | Implement analyze-impact — consumer graph builder + impact severity assessment | skill | 2.5 |
| F015-T4 | Implement topological sort (Kahn's algorithm) for migration_coordination_plan | skill | 1.5 |
| F015-T5 | Implement DFS cycle detection + circular_cross_repo_dependency_detected feedback | skill | 1.5 |
| F015-T6 | Implement sync-work-items — stub generation per affected repo with cross-refs | skill | 1.5 |
| F015-T7 | Register SKL-075 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| F015-T8 | Run `validate-skills.sh` and resolve any issues | CI | 0.5 |
| **Total** | | | **13 SP** |

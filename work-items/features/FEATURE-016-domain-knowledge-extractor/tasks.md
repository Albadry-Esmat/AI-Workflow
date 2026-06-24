# FEATURE-016 — Tasks & Acceptance Criteria

## Acceptance Criteria

### AC-1: Domain Auto-Detection from Artifacts
- Given `pipeline_artifacts` with no explicit `domain` field, but with db_entities containing fields named "patient_id", "diagnosis_code", and security_findings mentioning "HIPAA"
- When the extract operation runs
- Then the detected domain is `"healthcare"`
- And `new_domain_detected` feedback is emitted with `type: "info"` because no prior healthcare knowledge exists

### AC-2: Pattern Extraction Covers All Artifact Categories
- Given a completed pipeline with non-empty `db_entities` (3 entities), `security_findings` (2 OWASP categories), and `architecture.integration_points` (1 REST API)
- When the extract operation completes
- Then `domain_patterns` contains at least 3 entity patterns, 2 security patterns, and 1 API pattern
- And all patterns are written to state-manager under `domain_knowledge.healthcare`

### AC-3: Jaccard Deduplication Prevents Bloat
- Given an extract operation run a second time on artifacts that are 85% identical to the first run
- When the second extract processes each candidate pattern
- Then no new patterns are added to the knowledge base for the duplicated content (similarity > 0.8 → skip)
- And the second extract's output shows `new_patterns: 0` for the duplicated content and incremented `frequency` on matched existing patterns

### AC-4: Query Returns Ranked Patterns
- Given a `query` operation with `domain: "fintech"` and `query_intent: "authentication patterns for payment APIs"`
- When the knowledge base contains fintech security and API patterns
- Then `query_results` returns matching patterns ranked by relevance (security + api categories first)
- And each result includes `pattern_id`, `pattern_name`, `description`, `category`, and `confidence`

### AC-5: Inject Builds Target-Skill-Specific Context
- Given an `inject` operation with `target_skill: "security-review"` and `domain: "healthcare"`
- When the healthcare knowledge base contains entity, security, API, and compliance patterns
- Then `injection_context` contains only security patterns (`category: "security"`)
- And the context object is structured as a valid extension of `security-review`'s input schema with no entity or API fields present

### AC-6: Knowledge Base Size Guard Fires
- Given a domain knowledge base for `"ecommerce"` that has reached 205 patterns
- When an extract operation adds 3 more patterns (bringing total to 208)
- Then `knowledge_base_size_exceeds_threshold` feedback is emitted with `type: "warning"`
- And the feedback evidence includes `current_count: 208` and a recommendation to invoke context-compressor

---

## Definition of Done (DoD)

- [ ] `.opencode/skills/domain-knowledge-extractor/SKILL.md` (SKL-076) created — all 13 sections complete
- [ ] `skills/registry.json` updated — SKL-076 registered with `status: draft`
- [ ] `skills/index.yaml` updated — index entry for domain-knowledge-extractor added
- [ ] Domain detection correctly classifies all 5 domains (fintech, healthcare, ecommerce, b2b-saas, iot)
- [ ] Jaccard similarity deduplication implemented and verified (threshold 0.8)
- [ ] State-manager key structure matches §4 of plan.md
- [ ] inject operation filters patterns by target_skill correctly for all 4 supported target skills
- [ ] All 6 acceptance criteria above verified
- [ ] `scripts/validate-skills.sh` exits 0
- [ ] `status.md` `Status` set to `implemented` upon completion

---

## Sub-Tasks

| ID | Description | Skill / File | Est. SP |
|---|---|---|---|
| F016-T1 | Author `domain-knowledge-extractor/SKILL.md` — all 13 sections | new skill | 3.0 |
| F016-T2 | Implement domain auto-detection (keyword frequency classification) | skill | 1.5 |
| F016-T3 | Implement entity pattern extractor from db_entities | skill | 1.0 |
| F016-T4 | Implement security pattern extractor from security_findings (OWASP grouping) | skill | 1.0 |
| F016-T5 | Implement API + compliance pattern extractors | skill | 1.0 |
| F016-T6 | Implement Jaccard similarity deduplication against existing knowledge base | skill | 1.5 |
| F016-T7 | Implement query operation — relevance ranking by category match | skill | 1.5 |
| F016-T8 | Implement inject operation — target-skill-aware context formatting | skill | 2.0 |
| F016-T9 | Register SKL-076 in `skills/registry.json` and `skills/index.yaml` | registry | 0.5 |
| **Total** | | | **13 SP** |

# Batch O0 Completion Report — Agent-Neutral Onboarding Contract

**Status:** Complete and gated

**Scope:** Define and baseline an agent-neutral installation and first-use contract without implementing runtime installation, authentication flows, or adapter launch behavior.

**Branches:** `AI-Workflow/Dev` and `ASE-OS-Website/Dev` only. No `main` branch changes were made.

## 1. Delivered scope

Batch O0 establishes AI-Workflow as a runtime-neutral workflow control plane. The core owns orchestration intent, skills, execution contracts, capability policy, budgets, evaluations, evidence, target-project safety, and lifecycle state. OpenCode, Claude Code, Codex CLI, and a generic user-managed command are represented as replaceable runtime adapters rather than core dependencies.

The batch delivered the following source-owned contracts and controls:

| Deliverable | Source location | Result |
|---|---|---|
| Runtime adapter JSON Schema | `config/agent-runtime-adapter-schema.json` | Defines detection, installation, authentication, project context, launch, safety, evidence, recovery, and capability fields |
| Runtime adapter catalog | `config/agent-runtime-catalog.json` | Defines four initial candidate/generic adapters with explicit support levels and limitations |
| Runtime neutrality policy schema and instance | `config/agent-runtime-policy-schema.json`, `config/agent-runtime-policy.json` | Enforces no named-runtime core dependency, deterministic selection, no silent fallback, delegated auth, no raw secrets, and evidence requirements |
| Onboarding O0 schema and contract | `config/onboarding-o0-schema.json`, `config/onboarding-o0-contract.json` | Defines native, project-local, and Dev Container/Codespace lanes, command phases, auth boundaries, safety invariants, baseline metrics, and rollback |
| O0 fixtures | `evals/onboarding-o0/fixtures.json` | Covers catalog completeness, explicit-selection blocking, no-secret behavior, raw-secret rejection, generic support limits, maturity gates, and rollback |
| O0 validator | `scripts/validate-onboarding-o0-controls.py` | Validates all O0 schemas, catalog/policy invariants, onboarding contract, and fixture coverage |
| CLI/Makefile entry points | `aiw`, `Makefile` | Adds `aiw validate-onboarding-o0` and `make validate-onboarding-o0`; full `make validate` includes O0 |
| Documentation | `docs/agent-runtime-adapters.md`, `docs/onboarding-contract.md`, changelog | Records the core/adapter boundary, installation lanes, auth boundary, support levels, non-goals, and future batch boundaries |
| Website mirror and representation | `website/data/agent-runtimes.json`, `website/data/onboarding-o0.json`, companion Agents page | Adds a generated runtime catalog section explaining “one workflow, many agent runtimes” |

The initial catalog contains `opencode`, `claude-code`, `codex`, and `generic-command`. All named runtimes remain `planned` with `candidate` support level; the generic command remains `generic`. **No runtime is declared first-class by O0.**

## 2. Security and safety decisions

O0 makes the following decisions fail-closed:

| Decision | Policy |
|---|---|
| Core runtime dependency | AI-Workflow must not require OpenCode, Claude Code, Codex, or another named runtime |
| Runtime installation | AI-Workflow does not install a runtime by default; user action and explicit consent are required |
| Explicit selection | A requested adapter must either run or block; it must never silently fall back to another runtime |
| Automatic selection | `auto` selection must be deterministic and recorded in run evidence |
| Authentication | Runtime/provider login is delegated; AI-Workflow does not store raw runtime, provider, or GitHub secrets |
| No-secret path | The future no-secret demo must work without provider authentication |
| Support claims | First-class status requires verified fixtures; compatible status must declare limitations; generic mode cannot claim runtime safety or evidence |
| Unknown behavior | Unknown capabilities remain unknown and fail closed for claims |
| Target initialization | O0 defines that secrets must never be copied into target projects and that future mutation requires backup/rollback |
| Website claims | Runtime support claims are generated from source-owned catalog data |

## 3. Research basis

The initial adapter matrix was informed by official documentation for [OpenCode][1], [Claude Code][2], and [Codex CLI][3]. The research found that these runtimes have different installation channels, authentication flows, project-context conventions, permission controls, and recovery capabilities. O0 therefore records those differences as adapter metadata instead of flattening them into an OpenCode-shaped core.

O0 does not claim to have completed live runtime integration or provider authentication. Official documentation review is recorded as `fixture-pending` for the three named runtime candidates. Fixture verification is deferred to the later gated adapter implementation batches.

## 4. Validation evidence

The following gates passed after implementation and synchronization:

| Gate | Result |
|---|---:|
| O0 schema/catalog/policy/onboarding validator | Passed; all contract and policy checks passed |
| Full AI-Workflow validation | Passed, including prior Batches 0–9 and O0 |
| Source generated-data mirror check | Passed; 142 files up to date |
| Website tests | 39/39 passed |
| Website lint | Passed |
| Website production build | Passed; 129 static pages generated |
| Website dependency audit | Passed; 0 high-severity-or-higher vulnerabilities |
| ReleaseManifest validation | Passed |
| Release compatibility | `compatible`; zero violations |
| Worktree integrity | Source clean except four intentionally untracked planning files; website clean |

The final ReleaseManifest data hash is:

```text
sha256:007108de053b3e90285b10e9b979691082d6b99b37f40ffc8993b6c86090305d
```

## 5. Dev commits and synchronization state

| Repository | Batch O0 implementation commit | Role |
|---|---|---|
| AI-Workflow | `20df267f9eb99adf164e879ee91dadfc69de02a3` | O0 source implementation, validation controls, and generated source mirror |
| ASE-OS-Website | `2b821b0b38120b1af8b3d7b6556870ee2b31d079` | O0 generated data, ReleaseManifest, and visible Agents-page representation |

The website ReleaseManifest was generated from source commit `20df267f9eb99adf164e879ee91dadfc69de02a3`. Its `website_commit` field records the synchronization base `57b6e09f5234e62a24c39c94df79afab8365bffb`; the final website commit `2b821b0b38120b1af8b3d7b6556870ee2b31d079` is the pushed descendant containing the O0 page/data changes. Release compatibility accepts the manifest as current and compatible.

The four root planning artifacts remain untracked and were not staged:

```text
AI-Workflow-Comprehensive-Enhancement-Plan.md
AI-Workflow-Enhanced-Implementation-Plan.md
AI-Workflow-Enhancement-Research-Notes.md
AI-Workflow-Gated-Batch-Implementation-Plan.md
```

## 6. Known limitations and follow-ups

O0 is intentionally a contract/baseline batch. It does not implement `aiw agent list`, `aiw agent detect`, `aiw agent use`, `aiw agent doctor`, `aiw auth login`, `aiw auth status`, `aiw demo`, neutral `aiw start --agent`, runtime installation, provider login, target preflight, or first-class adapter launch evidence.

The current legacy setup and `aiw start` behavior still contain the pre-O0 OpenCode-oriented implementation. O0 does not silently replace that behavior. The next batch must implement the core toolchain and check-only setup contract before adding runtime detection and launch.

The three named adapters are candidate entries based on official documentation review, not live integration results. Their support level, sandbox mapping, structured-output mapping, MCP mapping, cancellation semantics, and recovery claims require runtime fixtures before any adapter is promoted to first-class.

The companion website renders the generated catalog, but the O0 adapter catalog is shown on the Agents page as a source-owned representation; runtime launch controls are not exposed in the website and no website-side agent execution is introduced.

## 7. Rollback procedure

O0 made no runtime installation, provider login, target-project mutation, or external write. To roll back the source:

```bash
cd /home/ubuntu/AI-Workflow
git revert 20df267f9eb99adf164e879ee91dadfc69de02a3
git push origin Dev
```

Then restore the website mirror to the previous source state, regenerate its ReleaseManifest, and rerun the source validation, website test/lint/build/audit, mirror check, and release compatibility gates. If the website commit must also be reverted, revert `2b821b0b38120b1af8b3d7b6556870ee2b31d079` on `ASE-OS-Website/Dev` and push that revert.

Future target-project initialization must create a backup manifest before any mutation; that behavior belongs to O4 and is not part of O0.

## 8. Decision boundary

**Batch O0 is complete.** Batch O1—deterministic core and adapter toolchain behavior—has not started. It requires explicit confirmation before implementation.

> **O0 outcome: one governed workflow, four declared runtime adapter candidates, zero runtime lock-in, zero default runtime installation, zero raw-secret handling, and a synchronized website representation.**

## References

[1]: https://opencode.ai/docs/ "OpenCode official introduction and setup documentation"

[2]: https://code.claude.com/docs/en/quickstart "Claude Code official quickstart"

[3]: https://github.com/openai/codex "OpenAI Codex CLI official repository"

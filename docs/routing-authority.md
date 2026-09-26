# Routing Authority Declaration (frozen-window safe, non-normative)

> This document declares intent and documents subordinate roles. It does NOT change
> routing behavior. The normative execution authority remains `.opencode/agent/primary.md`
> Intent Routing Table. No file listed below is modified by this document.

## Sole execution authority (P0/P1)

`.opencode/agent/primary.md:28-47` — first-match intent table, 10 rows + fallback ask-user.
Corroborated by `config/adaptive-flags.json:49` (`current_router`), `artifacts/shadow-observations/window-manifest.json:20`.

## Subordinate / observer roles (no divergence permitted in target, divergence logged as findings now)

| Representation | Role | Target state (post-G0) |
|---|---|---|
| `AGENTS.md` Pipeline Routing Table | Generated projection of `primary.md` for agent discoverability. Extended domain rows (compliance, admin-panel, …) re-added only via governed promotion. | Codegen from `config/routing-table.json`. |
| `scripts/log-shadow-observation.js legacyRoute()` | Observer mirror for shadow logging only. Never routes, never enforces (`:6,74-75`). | Codegen mirror, byte-identical triggers, or shared import. |
| `config/task-router.yaml` + `scripts/task-router.js` | Subordinate second-stage router: input = pipeline template already chosen by `primary.md`; output = WHAT executes (pipeline/agent/stage) + `model_requirement` reference. Must not re-decide intent, must not declare model IDs (enforced in code `:30-44`). `default_route: feature-delivery` applies only inside its own stage. | Header rewritten to state subordinate role; precedence documented; retirement evaluated (not decided — retirement changes launch path). |
| `scripts/task-intelligence-wrapper.js` | Observe-only signal producer (heuristic shadow, NO LLM, NO authority). | Unchanged role; prompt/version changes require new window. |
| `scripts/safety-detector.js` | Observe-only floor producer (`FLAG_FLOOR_ENFORCE=false`). | Unchanged role until P2 authorization. |

## Known divergences (findings, not fixed — fixing now would STALE the window)

1. `AGENTS.md` has 24 rows vs `primary.md` 10 rows.
2. `legacyRoute()` trigger subsets differ from `primary.md` (e.g. requirements row omits `clarify this requirement`).
3. `task-router.yaml` 3 routes vs intent table 10 rows; precedence between the two tables undocumented in code.
4. Substring matching fragility + first-match ordering allow keyword-avoidance bypass by design in P0/P1.

## Future non-bypassable layer (designed, NOT activated, requires G0 close + P2 auth)

Detector floor + `policy-gateway` entry guard + `workflow-state` entry validation force the stronger pipeline when risk signals fire regardless of keywords. Activation = `FLAG_FLOOR_ENFORCE=true` + `FLAG_ADAPTIVE_ROUTER=true` + new bound window + promotion gates. Nothing in this document enables it.

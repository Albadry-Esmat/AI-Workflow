# P0 OpenCode Duplicate-Discovery Evidence (2026-09-27)

**Runtime:** `opencode 1.18.32` (`/Users/albadryesmat/.opencode/bin/opencode`)
**Command:** `opencode debug skill --print-logs` (JSON list of `{name, description, location, content}`)
**Docs basis:** `https://opencode.ai/docs/skills/` — OpenCode searches
`.opencode/skills/`, `.claude/skills/`, `.agents/skills/` (project + global),
walks CWD → git worktree, registers sources lower→higher precedence,
“Selects the current definition for that ID”.

## Case 0 — Baseline (this repo state after move, NO `.opencode/skills/`)

- Total registrations: **123**
- Via `.agents/skills/`: **121**
- Other (built-in + `~/.config/opencode/skills/graphify`): **2**
- Unique names: **123**, duplicate IDs: **0**

Conclusion: OpenCode discovers all 121 canonical skills natively from
`.agents/skills/`. Acceptance criterion #5 satisfied with no shim.

## Case S — Temporary symlink `.opencode/skills -> ../.agents/skills`

- Total registrations: **123** (unchanged)
- Via `.opencode/skills/`: **70**
- Via `.agents/skills/`: **51**
- Other: **2**
- Unique names: **123**, duplicate IDs: **0**

Conclusion: OpenCode deduplicates by skill ID (no doubled registrations —
strict Case-A count behavior holds). HOWEVER source attribution splits
70/51 across the two paths for identical bodies: the same skill ID resolves
via different `location` values depending on walk order. That is
**ambiguous resolution / shadowing** per the approved amendment’s Case-B
trigger list, plus a Windows-symlink liability and cache/provenance
instability (`location` feeds evidence, `run_manifest_adapter_id`,
`skills`-version caching).

## Decision (recorded): Case B — NO `.opencode/skills` symlink shim

Rationale (safest deterministic option within approved scope):

1. Zero benefit: all repo-owned references already retargeted to
   `.agents/skills/`; OpenCode resolves 121/121 without the old path.
2. Ambiguous `location` (70/51 split) compromises runtime correctness
   signals just to preserve a stale filesystem path — forbidden by the
   invariant (“one canonical executable SKILL.md body per portable skill”).
3. Symlinks are unavailable/unreliable on some Windows checkouts; the
   approved fallback order (junction → proxy) adds complexity for no gain.
4. Old-tooling compatibility is covered by diagnostics (validator +
   health emit explicit `MOVED_TO_AGENTS` guidance), not by a shadow
   discovery root.

Full JSON outputs (2.3 MB each, full skill bodies) were verified then
removed to keep the diff lean; this summary + `tests/test-opencode-discovery.sh`
(which re-proves the filesystem-level invariant in CI without requiring the
`opencode` binary) constitute the durable evidence.
Raw counts reproducible via: `opencode debug skill --print-logs | python3 -c
"import json,sys; d=json.load(sys.stdin); print(len(d))"`.

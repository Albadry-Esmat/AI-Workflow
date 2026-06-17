# Dependency Analyzer — Knowledge Reference

## Principles

- **Graph accuracy over graph speed**: An incorrect dependency graph produces incorrect impact analyses and incorrect test invalidation. Accuracy is the primary constraint; rebuild speed is secondary.
- **Cycles are always errors at module boundaries**: Within a single module, a cycle (e.g., two helper functions calling each other) is a warning. Across module boundaries, a cycle is an architectural violation that must be resolved before the pipeline continues.
- **Incremental over full rebuild**: After a single file change, only re-parse that file's edges and update the affected nodes. Full rebuilds are only needed when the architecture module definitions change.
- **External dependencies are tracked but not traversed**: Third-party library edges (npm, pip, etc.) are recorded in the graph but are not included in ripple-effect traversal. Library changes are analyzed separately by security-review.
- **Depth-bounded traversal**: Transitive dependency traversal is capped at depth 10. Beyond depth 10, the signal-to-noise ratio drops below useful threshold in all observed production codebases.

## Graph Structure

```
Node:  { id: module_name, files: [path, ...], version: string }
Edge:  { from: importer, to: imported, type: internal|cross-module|external, depth: integer }
```

- `internal`: both ends belong to the same module
- `cross-module`: ends belong to different modules (highest signal for impact analysis)
- `external`: imported target is a third-party package (tracked, not traversed)

## Cycle Detection Algorithm

The skill uses iterative DFS with a color-marking scheme:
- WHITE = unvisited, GRAY = in current path, BLACK = fully processed
- A GRAY node encountered during traversal = cycle detected
- Cycle is reported as the ordered path from the entry GRAY node back to itself

## Ripple Effect Classification

| Depth from Change | Label | Action |
|-------------------|-------|--------|
| 0 | Source | The changed module itself |
| 1 | Direct | Modules that directly import the source |
| 2–5 | Near transitive | Likely to be affected — include in test invalidation |
| 6–10 | Far transitive | May be affected — flag for manual review |
| >10 | Truncated | Traversal capped — flag in graph_stats |

## Anti-patterns

- **Stale graph**: Running change-impact-analyzer against a dependency graph that was not updated after the most recent code change. All graph reads must verify `last_updated` timestamp.
- **Ignoring internal edges**: Treating `internal` edges as irrelevant. Within-module cycles still indicate design problems and must be reported (as warnings).
- **Over-traversal**: Not capping traversal depth and running into very large graphs where depth-10+ modules have no meaningful connection to the original change.
- **Missing external edges**: Excluding third-party packages from the graph entirely. External edges are needed to identify which library versions a module depends on (for security scanning).

## Source References

- Tarjan's strongly connected components algorithm
- Kahn's algorithm for topological sort
- Layered architecture dependency rules (Robert C. Martin, "Clean Architecture")

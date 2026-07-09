## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Pipeline Routing Table

Match the first row whose triggers overlap with the user's request, then pass the `pipeline` file path as `pipeline_config` to the orchestrator skill.

| Triggers (keywords / phrases) | Pipeline Template | Entry Agent |
|-------------------------------|-------------------|-------------|
| "analyze requirements", "extract requirements", "clarify this requirement", "turn this into requirements", "what are the requirements" | `skills/pipelines/requirements-only.json` | `analyzer` |
| "design the architecture", "system design", "define modules", "what tech stack", "how should the system be structured" | `skills/pipelines/architecture-only.json` | `analyzer` |
| "full pipeline", "build this feature", "new feature", "idea to production", "start the pipeline", "run the pipeline", "execute the full workflow", "orchestrate" | `skills/pipelines/full-pipeline.json` | `analyzer` |
| "review code", "code review", "code quality", "SOLID", "refactor", "anti-patterns", "is this clean code" | `skills/pipelines/quick-review.json` | `reviewer` |
| "security review", "find vulnerabilities", "threat modeling", "is this secure", "security audit" | `skills/pipelines/quick-review.json` | `reviewer` |
| "deploy", "release", "pre-deploy check", "how do we deploy", "CI/CD", "rollback" | `skills/pipelines/pre-deploy.json` | `tester` |
| "plan this feature", "break this down", "task breakdown", "roadmap", "sprint planning" | `skills/pipelines/full-pipeline.json` (resume from `feature-planning`) | `planner` |
| "compliance", "SOC 2", "HIPAA", "GDPR", "ISO 27001", "compliance-first", "compliance pipeline", "compliance frameworks" | `skills/pipelines/compliance-first.json` | `analyzer` |

**Fallback:** If no trigger matches, ask the user: "Which stage of the pipeline do you need — requirements, architecture, review, testing, deployment, or the full pipeline?"

# Sub-Agent Creation — Knowledge Reference

## Principles

- **One responsibility per agent**: A sub-agent must do exactly one thing. If you can describe its role with "and", split it into two agents.
- **Agents are thin — skills are smart**: Business logic lives in skills. Agents only route inputs to skills, collect outputs, and enforce tool permissions. An agent that contains embedded decision logic is a design smell.
- **Tool permissions by minimum viable access**: An agent receives only the tools it needs for its specific responsibility. Read-only agents never get write permissions. Agents that produce artifacts but don't execute code never get `bash`.
- **I/O contracts are schemas**: Agent inputs and outputs are defined as JSON Schema — not as prose descriptions. Prose descriptions are for human understanding only; schemas govern execution.
- **Orchestrator controls all agents**: No sub-agent may spawn another sub-agent without the orchestrator's explicit delegation. The agent hierarchy is flat (orchestrator + N subagents) — no peer-to-peer spawning.

## Agent Design Dimensions

| Dimension | Question to Answer |
|-----------|-------------------|
| Responsibility | What single function does this agent perform? |
| Input contract | What structured inputs does it require? |
| Output contract | What structured artifacts does it produce? |
| Tool set | Which tools does it need (and which must it never use)? |
| Skill binding | Which SKILL.md file(s) govern its execution? |
| Failure mode | What does it do when its primary skill fails? |
| HITL gate | Under what conditions does it pause for human review? |

## Common Sub-Agent Archetypes

| Archetype | Responsibility | Typical Tools |
|-----------|---------------|--------------|
| Analyzer | Extract and validate structured data from raw input | read, glob, grep |
| Generator | Produce artifacts (code, docs, tests) from specs | read, write, edit |
| Reviewer | Validate artifacts against quality rules | read, grep |
| Executor | Run system commands and report results | bash (scoped) |
| Router | Classify intent and delegate to correct sub-agent | none |
| Monitor | Collect metrics and emit alerts | read, write |

## Anti-patterns

- **Fat agent**: An agent that embeds conditional logic, domain rules, or multi-step workflows. These belong in skills.
- **Orphan agent**: An agent defined in `opencode.json` that is not bound to any skill. Unbound agents have no governed execution path.
- **Privilege creep**: Granting an agent `bash: allow` because "it might need it sometime." Tool permissions are reviewed at every version bump.
- **Agent-to-agent direct call**: One subagent calling another subagent directly. All inter-agent communication goes through the orchestrator.

## Source References

- Multi-agent system design patterns (LangGraph, AutoGen)
- Principle of least privilege (OWASP, NIST SP 800-53)
- Tool use and permission scoping in agentic frameworks

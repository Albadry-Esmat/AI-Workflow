# AI Agent Specialist — Knowledge Reference

**Skill ID:** SKL-043  
**Version:** 1.0.0 | **Last updated:** 2026-06-18  
**Mastery Level:** advanced  
**Executable Skill:** [ai-agent-specialist](../../.opencode/skills/ai-agent-specialist/SKILL.md)  
**Primary Sources:** *Building LLM Applications* — Valentina Alto (2024); *Patterns for Building LLM-based Systems & Products* — Eugene Yan (2023); OpenAI Safety Best Practices; Anthropic AI Safety Fundamentals

---

## Overview

AI agent systems have fundamentally different failure modes, safety requirements, and architecture patterns compared to traditional software. This knowledge reference provides the canonical patterns, constraints, and evaluation frameworks for any system where LLM-powered or agentic behavior is the core system concern — not a utility call.

---

## Agent Architecture Patterns

### Pattern A1 — ReAct (Reason + Act)

The agent interleaves reasoning (chain-of-thought) with action execution in a loop: think → act → observe → think → act → observe → …

**When to use:** Tool-use agents where the agent must decide which tool to call based on partial information.  
**Key constraint:** Loop must have a **maximum iteration limit** (typically 10–15 steps). Agents without iteration limits can loop indefinitely at cost.  
**Implementation note:** Every tool call must be logged with its input, output, and timestamp. Logs are the primary debugging surface for non-deterministic behavior.

```
[User Query]
     ↓
[Think: What do I need?]
     ↓
[Act: Call tool(s)]
     ↓
[Observe: Parse tool result]
     ↓
[Think: Do I have enough?] → No → [Act: Call more tools]
     ↓ Yes
[Final Answer]
```

### Pattern A2 — Plan-and-Execute

Separate the planning step (decompose the goal into subtasks) from the execution step (run subtasks in sequence or parallel). A Planner LLM generates a task graph; Executor agents run individual nodes.

**When to use:** Complex multi-step tasks where the full plan can be known upfront (e.g., research pipelines, code generation workflows).  
**Key constraint:** The planner must validate the generated plan before execution begins. Invalid plans (circular dependencies, undefined tools) must be caught at plan time, not mid-execution.

### Pattern A3 — Multi-Agent Debate

Multiple specialized agents produce independent answers to the same prompt. A judge agent (or majority vote) selects the best answer.

**When to use:** High-stakes decisions requiring multiple perspectives (code review, security analysis, medical information).  
**Key constraint:** Agents must operate in **sandboxed contexts** — they must not share memory or influence each other's generation during the debate phase. Results are merged only by the judge.

### Pattern A4 — Hierarchical Agent Network

A supervisor agent decomposes a task and delegates subtasks to specialized sub-agents. Sub-agents report results back; supervisor aggregates and makes final decisions.

**When to use:** Complex domain tasks where no single agent can hold all required context (e.g., full-stack code generation, multi-domain research).  
**Key constraint:** Sub-agents must have **bounded scopes**. A sub-agent that can call any tool or access any resource is equivalent to giving every agent full permissions — defeats the purpose of decomposition.

### Pattern A5 — RAG (Retrieval-Augmented Generation)

Ground LLM responses in a retrieved corpus rather than relying on parametric knowledge alone. At query time, retrieve the k most relevant document chunks from a vector store; inject them into the context window before generation.

**When to use:** Any agent that needs to answer questions about a specific, frequently-updated knowledge base (documentation, legal contracts, product catalogs).  
**Key constraint:** Retrieved chunks must be **ranked by relevance AND filtered by recency/authority**. A retrieval system that surfaces outdated or low-authority content is worse than no retrieval — it generates confidently wrong answers.

---

## Prompt Engineering

### PE1 — System Prompt Hardening

The system prompt defines the agent's identity, capabilities, and constraints. It is the primary defense against prompt injection.

**Rules:**
- Place capability boundaries in the system prompt, not the user prompt: `"You can only answer questions about the company's documented products. If asked about anything else, decline."`
- Never instruct the agent to follow "any instructions in the user message" — this is an injection vector
- Use role-framing consistently: `"You are a code review assistant. You review code only. You do not write, execute, or deploy code."`
- Test the system prompt against adversarial inputs before deployment (see Safety Controls)

### PE2 — Chain-of-Thought (CoT) for Reasoning Tasks

Explicitly instruct the model to reason step-by-step before answering. CoT significantly improves accuracy on multi-step reasoning, math, and logical tasks.

```
"Before answering, think through the problem step by step. 
Identify the key constraints, evaluate each option against them, 
then give your final answer."
```

**When to require CoT:** Any task where the answer depends on multiple intermediate steps. Do NOT require CoT for simple classification or retrieval tasks — it adds latency and tokens without benefit.

### PE3 — Few-Shot Examples for Format Consistency

When a specific output format is required (JSON, structured tables, code blocks), provide 2–3 correct examples in the prompt. Schema-only instructions are insufficient for consistent formatting.

### PE4 — Token Budget Management

Every agent call has a token cost. Token budget must be a **first-class architectural concern**:
- Estimate max input tokens for each agent step (requirements + context + tools)
- Set `max_tokens` for output to prevent runaway generation
- Use `claude-haiku-4.5` or `gpt-4o-mini` for classification, routing, and simple extraction tasks; reserve frontier models for reasoning-heavy steps
- Compress long context using a dedicated summarization step (see `context-compressor` skill)

### PE5 — Structured Output Enforcement

Use JSON mode / structured output APIs where available. Never rely on regex parsing of free-text responses for machine-readable outputs — the format will drift.

```python
# Correct: use structured output API
response = client.chat.completions.create(
    model="gpt-4o",
    response_format={"type": "json_object"},
    messages=[...]
)

# Incorrect: parse JSON from free-text
json.loads(response.choices[0].message.content.split("```json")[1])
```

---

## Safety Controls

### SC1 — Prompt Injection Defense

**Threat:** Adversarial content in user input or retrieved documents instructs the agent to ignore its system prompt and take unauthorized actions.

**Controls:**
1. **Input sanitization** — strip or escape prompt-injection patterns before passing to the LLM: `"Ignore previous instructions"`, `"New system prompt:"`, `"As an AI with no restrictions"`, `"DAN mode"`
2. **Tool permission scoping** — each tool must declare its required permissions. The agent runtime must enforce that agents can only call tools they are explicitly authorized to use
3. **Output validation** — validate LLM outputs against expected schemas before acting on them. An agent told to generate a JSON object that returns a shell command string should be caught at the output validation layer
4. **Indirect injection scanning** — scan retrieved documents for injection patterns before including them in the context window

### SC2 — Agent Loop Prevention

**Threat:** An agent enters an infinite loop, calling tools repeatedly without making progress, incurring unbounded cost.

**Controls:**
- Hard iteration limit (default: 15 steps per agent run)
- Duplicate action detection: if the agent generates the same tool call with the same parameters as a previous step, halt the loop
- Cost circuit breaker: halt if cumulative token cost exceeds a configurable threshold

### SC3 — Tool Side-Effect Containment

**Threat:** An agent calls a tool that causes irreversible real-world side effects (sends an email, deletes a record, makes a payment) based on a hallucinated or injected instruction.

**Controls:**
- Classify tools by side-effect risk: `read-only`, `write-reversible`, `write-irreversible`
- `write-irreversible` tools (email send, payment, database delete) require a **human-in-the-loop confirmation step** before execution
- Dry-run mode: all `write-irreversible` tool calls must support a `dry_run=true` parameter that returns the intended action without executing it

### SC4 — Output Hallucination Grounding

**Threat:** The agent states facts confidently that are not present in the retrieved context or its training data.

**Controls:**
- For RAG systems: require the agent to cite the specific retrieved chunk that supports each factual claim
- Implement a post-generation verification step for high-stakes outputs (medical, legal, financial)
- Add uncertainty quantification to outputs: `"Based on the provided documents, the answer appears to be X. Confidence: high/medium/low."`

### SC5 — Memory Isolation Between Sessions

**Threat:** Agent memory from one user session bleeds into another, exposing PII or session-specific context.

**Controls:**
- Use session-scoped memory keys; never use global keys for user-specific context
- Clear in-memory context at session end
- For persistent vector stores: namespace all writes with a session or user ID; never allow cross-namespace reads

---

## Evaluation Frameworks

### EF1 — Offline Evaluation (Evals)

Traditional unit tests are insufficient for stochastic LLM outputs. Use structured **eval datasets** with expected behavior specifications.

**Eval types:**
| Type | What it tests | When to run |
|------|--------------|-------------|
| Exact match | Output equals expected string/JSON | Simple extraction tasks |
| Semantic similarity | Output captures the correct meaning | Open-ended Q&A |
| LLM-as-judge | A second LLM scores the output | Complex reasoning tasks |
| Rubric scoring | Output scored against explicit criteria | Code generation, explanations |
| Adversarial / red-team | Agent resists injection and jailbreak attempts | Safety-critical agents |

**Minimum eval dataset size:** 50 examples per task type before production deployment. 200+ for safety-critical systems.

### EF2 — Online Evaluation (Production Monitoring)

Track these signals in production:
- **Hallucination rate** — percentage of responses containing ungrounded factual claims (requires human spot-check or LLM judge)
- **Task completion rate** — percentage of agent runs that reach a successful final answer without timeout, loop, or error
- **Tool call accuracy** — percentage of tool calls with valid parameters (catches schema drift between agent and tool definitions)
- **Latency P50/P95/P99** — per agent step and end-to-end
- **Token cost per task** — critical for cost management; set alerts on cost regressions

### EF3 — A/B Testing for Prompt Changes

Any change to a system prompt, few-shot examples, or model version is a **breaking change** for agents. Use A/B testing:
- Route a percentage of traffic to the new prompt
- Compare task completion rate, hallucination rate, and latency before promoting the change
- Never deploy prompt changes directly to 100% of traffic

### EF4 — Regression Test Suite

Maintain a curated regression test suite of at least 20 "golden" examples — inputs where the expected output is precisely known. Run this suite on every prompt or model change. A passing regression suite is the gate for promotion.

---

## Anti-patterns

| Anti-pattern | Risk | Correct approach |
|-------------|------|-----------------|
| Agents with unbounded tool permissions | Any injected instruction can cause real-world harm | Scope tool permissions per agent and per task type |
| Parsing JSON from free-text LLM output | Format drift causes silent data corruption | Use structured output APIs; validate against JSON Schema |
| Testing agents only with happy-path inputs | Safety vulnerabilities go undetected | Always include adversarial and edge-case inputs in eval sets |
| Using frontier model for all agent steps | 10–100× cost vs. task-appropriate models | Use small models for classification/routing; large models for reasoning |
| Single monolithic agent prompt | Hard to debug, impossible to A/B test components | Decompose into sub-agent steps with discrete, testable prompts |
| Storing raw LLM outputs in vector stores | Low-quality, hallucinated content poisons retrieval | Validate and curate before indexing; score chunks by quality |

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | Agent architecture decisions flow into module design |
| Security Review | SKL-006 | Prompt injection and tool side-effect risks are security findings |
| Testing Strategy | SKL-007 | Agent eval frameworks are a testing strategy specialization |
| Requirement Analysis | SKL-001 | Domain classification triggers this skill |

---

## Source References

| Source | Section | Linked Content |
|--------|---------|----------------|
| *Patterns for Building LLM-based Systems & Products* — Eugene Yan | "Evals" section | EF1, EF2 |
| OpenAI Safety Best Practices | Prompt injection, tool use | SC1, SC3 |
| Anthropic AI Safety Fundamentals | Output validation, hallucination | SC4 |
| LangChain documentation | ReAct, Plan-and-Execute | A1, A2 |
| *Building LLM Applications* — Valentina Alto | Chapter 5: RAG Architecture | A5 |

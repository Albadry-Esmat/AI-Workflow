---
name: ai-agent-specialist
version: 1.0.0
domain: domain-specialist
description: 'Use when designing, building, or reviewing AI agent systems, LLM-powered applications, RAG pipelines, multi-agent orchestration, or tool-use frameworks. Triggers on: "AI agent", "LLM", "RAG", "multi-agent", "prompt engineering", "vector database", "fine-tuning", "agentic system", "AI chatbot". Do NOT use for general software systems that merely call an AI API as a utility — only use when the AI/agent behavior is the core system concern.'
author: ASE-OS
---

# AI Agent Specialist

**Version:** 1.0.0 | **Last updated:** 2026-06-18

Domain specialist that injects AI/agent-specific architecture patterns, safety controls, evaluation frameworks, and implementation standards into the pipeline when an AI agent or LLM-powered system is being built. Runs at Layer 2c, in parallel with `architecture-design`, and produces `domain_constraints` consumed by downstream pipeline skills.

---

## 1. Skill Header

```yaml
name: ai-agent-specialist
version: 1.0.0
domain: domain-specialist
description: >
  Use when designing, building, or reviewing AI agent systems, LLM-powered
  applications, RAG pipelines, multi-agent orchestration, or tool-use frameworks.
  Triggers on: "AI agent", "LLM", "RAG", "multi-agent", "prompt engineering",
  "vector database", "fine-tuning", "agentic system", "AI chatbot".
  Do NOT use for general software systems that merely call an AI API as a utility.
author: ASE-OS
```

---

## 2. Purpose

AI agent systems have fundamentally different failure modes, safety requirements, and architecture patterns compared to traditional software. A standard pipeline without domain expertise will miss:

- **Non-determinism** — the same input may produce different outputs; testing must use statistical coverage, not exact match
- **Prompt injection** — adversarial inputs can hijack agent behavior; requires input sanitization that differs from SQL injection
- **Token economy** — cost is a first-class architectural concern, not an afterthought
- **Context window limits** — architectural decisions must account for maximum context length
- **Tool misuse** — agents calling tools with incorrect parameters cause real side-effects (API calls, database writes, emails sent)
- **Agent loops** — without loop detection, agents can recurse infinitely
- **Hallucination** — outputs must be grounded and validated, especially in RAG pipelines
- **Memory architecture** — choosing between in-context, external (vector), episodic, and procedural memory has major system impact
- **Evaluation** — traditional unit tests don't cover the stochastic output space; requires specialized eval frameworks

`ai-agent-specialist` enforces the correct architecture patterns, safety controls, and testing strategies for all of these concerns before a single line of code is written.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Structured requirements from `requirement-analyzer` |
| `architecture` | `object` | No | Partial or draft architecture from `architecture-design` (if available) |
| `domain_context` | `object` | Yes | Domain classification from `prompt-normalizer` (confirms `domain_primary: "ai_agent"`) |
| `agent_system_type` | `string` | No | Specific agent type: `single_agent`, `multi_agent`, `rag_pipeline`, `tool_use`, `fine_tuned`, `hybrid` |
| `model_providers` | `array[string]` | No | LLM providers in use (e.g., `["openai", "anthropic", "ollama"]`) |
| `safety_level` | `string` | No | `"standard"` (default) or `"high"` (for medical, legal, financial, or child-facing AI) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "domain_context"],
  "properties": {
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id","type","statement","priority"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F","NF","C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string" }
        }
      }
    },
    "architecture": { "type": "object" },
    "domain_context": {
      "type": "object",
      "required": ["domain_primary"],
      "properties": {
        "domain_primary": { "type": "string", "enum": ["ai_agent"] }
      }
    },
    "agent_system_type": {
      "type": "string",
      "enum": ["single_agent","multi_agent","rag_pipeline","tool_use","fine_tuned","hybrid","unknown"],
      "default": "unknown"
    },
    "model_providers": {
      "type": "array",
      "items": { "type": "string", "enum": ["openai","anthropic","google","meta","mistral","ollama","huggingface","cohere","other"] }
    },
    "safety_level": {
      "type": "string",
      "enum": ["standard","high"],
      "default": "standard"
    }
  }
}
```

---

## 4. Required Context

- `requirements` from `requirement-analyzer` (SKL-001) is mandatory.
- `domain_context.domain_primary` must be `"ai_agent"` — this guard prevents accidental invocation on non-AI systems.
- `agent_system_type` defaults to `"unknown"` if not provided; the skill infers it from requirements.
- `safety_level: "high"` activates additional controls for sensitive-domain AI (medical diagnosis, legal advice, financial decisions, content targeting children).

---

## 5. Execution Logic

```
Step 1 — Infer agent system type (if not provided)
  Scan requirements for signals:
    RAG pattern signals:      "document retrieval", "knowledge base", "semantic search",
                              "vector store", "citation", "grounding"
    Multi-agent signals:      "multiple agents", "agent team", "agent collaboration",
                              "orchestrator agent", "worker agent", "swarm"
    Tool-use signals:         "tool calling", "function calling", "execute code",
                              "search the web", "send email", "call API"
    Fine-tuning signals:      "fine-tune", "custom model", "domain-specific model",
                              "RLHF", "instruction tuning"
    Single agent (default):   chatbot, assistant, conversational agent
  Output: inferred_agent_system_type

Step 2 — Select architecture pattern for agent type
  Map inferred_agent_system_type to architecture pattern:

  single_agent:
    Pattern: ReAct (Reason + Act) loop with tool registry
    Modules: [LLMClient, PromptManager, ToolRegistry, MemoryStore, SafetyFilter, OutputValidator]
    Key constraints:
      - Max loop iterations: 10 (configurable, never unbounded)
      - Tool call timeout: 30s per tool
      - Output must pass SafetyFilter before returning to user

  multi_agent:
    Pattern: Supervisor-Worker with message bus
    Modules: [Orchestrator, WorkerPool, MessageBus, SharedMemory, ConflictResolver, ResultAggregator]
    Key constraints:
      - Agent count ceiling: 10 concurrent agents (performance/cost)
      - Message bus must be async (no blocking agent-to-agent calls)
      - Shared state must be append-only (no destructive writes between agents)
      - Orchestrator must detect and break loops (max 3 cycles of same task)

  rag_pipeline:
    Pattern: Retrieval-Augmented Generation with evaluation
    Modules: [DocumentIngester, Chunker, Embedder, VectorStore, Retriever, Reranker, LLMGenerator, GroundingValidator]
    Key constraints:
      - Chunk size: 512–1024 tokens with 10–15% overlap
      - Top-k retrieval: 5–10 chunks (tune by domain)
      - Grounding check: every response must cite retrieved chunks
      - Hallucination detection: response must be entailed by retrieved context

  tool_use:
    Pattern: Tool-calling agent with permission model
    Modules: [ToolRegistry, PermissionEnforcer, ToolExecutor, OutputParser, SideEffectLogger]
    Key constraints:
      - All tools must have explicit permission scopes (read-only vs. write)
      - Write-capable tools require confirmation step before execution
      - Tool execution is sandboxed (no direct filesystem access without explicit grant)
      - All tool calls logged with input/output for audit

  fine_tuned:
    Pattern: Custom model + evaluation pipeline
    Modules: [DataPipeline, TrainingOrchestrator, EvalSuite, ModelRegistry, ABTestRouter]
    Key constraints:
      - Training data must be audited for bias and PII before training
      - Eval suite must include domain-specific test sets (not just MMLU)
      - Model must be red-teamed before production deployment
      - Fallback to base model when fine-tuned model confidence < threshold

  Output: architecture_pattern, required_modules, module_constraints

Step 3 — Produce prompt engineering standards
  Define prompt template structure for this system type:
    System prompt: role definition + capability boundary + safety rules
    User prompt:   input sanitization rules + injection detection patterns
    Assistant:     output format spec + grounding requirements
  Injection prevention patterns:
    - Ignore/override detection: flag prompts containing "ignore previous instructions",
      "you are now", "forget your rules", "new system prompt"
    - Indirect injection: flag tool outputs containing instruction-like text before
      passing back to LLM context
    - Role-play escape: flag attempts to enter characters that bypass safety rules
  Output: prompt_standards { system_prompt_template, injection_patterns, sanitization_rules }

Step 4 — Define memory architecture
  Classify memory needs from requirements:
    In-context (default):     conversation history in the context window
    External / vector:        long-term knowledge, document retrieval
    Episodic:                 per-user conversation history stored externally
    Procedural:               tool definitions, agent workflows stored as structured data
  Recommend:
    context_window_budget:    max tokens reserved for each memory type
    retention_policy:         how long episodic/procedural memory is kept
    eviction_strategy:        FIFO, relevance-weighted, recency-weighted
  Output: memory_architecture

Step 5 — Define token budget and cost model
  Estimate per-interaction token costs:
    input_tokens:  system_prompt + user_input + retrieved_context + tool_outputs
    output_tokens: LLM response + tool call specifications
  Define token budgets:
    max_input_tokens:  (context_window × 0.7)  — leave 30% for output
    max_output_tokens: (context_window × 0.25) — reserve 5% for safety margin
    max_tool_output:   500 tokens per tool response (truncate if exceeded)
  Cost optimization rules:
    - Use smaller/cheaper model for classification/routing sub-tasks
    - Cache identical prompt+retrieved_context combinations (TTL: 5 min)
    - Streaming responses for user-facing outputs (reduce perceived latency)
    - Batch embedding requests (max 100 texts per API call)
  Output: token_budget, cost_optimization_rules

Step 6 — Define evaluation framework
  AI systems require stochastic testing beyond standard unit tests:
    Functional evals:
      - Intent classification accuracy (target ≥ 95% on test set)
      - Tool selection accuracy (target ≥ 90%)
      - Response relevance score (BLEU/ROUGE for extractive; human eval for generative)
    Safety evals:
      - Prompt injection resistance (test corpus of 50+ injection patterns)
      - Harmful content rate (target: 0 harmful responses in 1000-run test)
      - Hallucination rate (grounding check on RAG pipeline)
    Performance evals:
      - P95 latency target (define per use case, typically < 3s for interactive)
      - Token cost per interaction (track against budget)
      - Context window utilization (flag if > 85% consistently)
    Regression evals:
      - Golden dataset (50+ curated user queries with expected behavior)
      - Run on every model or prompt version change
  Output: eval_framework

Step 7 — Define AI safety controls
  Controls required for all AI systems:
    - Input sanitization:   strip/escape injection patterns before LLM call
    - Output filtering:     post-process LLM output through safety classifier
    - Rate limiting:        per-user, per-IP, per-session limits on API calls
    - Content moderation:   flag/block harmful, biased, or off-topic outputs
    - Audit logging:        log all LLM inputs and outputs (masked PII) for review
    - Human escalation:     automatic handoff to human when confidence < threshold
    - Graceful degradation: return safe fallback when LLM is unavailable or errs

  Additional controls when safety_level == "high":
    - All outputs reviewed by secondary safety model before delivery
    - No user-facing output without explicit confidence score
    - Mandatory disclaimer injection for medical, legal, financial advice
    - Zero-tolerance hallucination policy (verify all factual claims)
    - GDPR/CCPA compliance for conversation history storage
  Output: safety_controls

Step 8 — Produce domain_constraints
  Assemble all outputs from steps 2–7 into a structured domain_constraints object
  consumed by architecture-design, testing-strategy, code-generator, and security-guard.
  Output: domain_constraints
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `domain_constraints` | `object` | **Primary output.** All AI-specific constraints for downstream pipeline skills |
| `architecture_pattern` | `object` | Recommended pattern, required modules, and module-level constraints |
| `prompt_standards` | `object` | System/user prompt templates, injection patterns, sanitization rules |
| `memory_architecture` | `object` | Memory types, context window budget, retention policies |
| `token_budget` | `object` | Per-interaction token limits and cost optimization rules |
| `eval_framework` | `object` | Functional, safety, performance, and regression eval definitions |
| `safety_controls` | `object` | Required safety controls, scaled by `safety_level` |
| `agent_checklist` | `array[string]` | Implementation checklist for the builder agent |
| `metadata` | `object` | Input summary, inferred agent type, safety level, version |
| `metrics` | `object` | REQUIRED. Standard execution metrics |
| `feedback` | `array[object]` | REQUIRED. Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domain_constraints","architecture_pattern","prompt_standards","memory_architecture",
               "token_budget","eval_framework","safety_controls","agent_checklist","metadata","metrics","feedback"],
  "properties": {
    "domain_constraints": {
      "type": "object",
      "description": "Consumed by architecture-design, testing-strategy, code-generator, security-guard",
      "required": ["domain","agent_system_type","required_modules","module_constraints",
                   "safety_controls","eval_requirements","token_constraints"],
      "properties": {
        "domain":            { "type": "string", "const": "ai_agent" },
        "agent_system_type": { "type": "string" },
        "required_modules":  { "type": "array", "items": { "type": "string" } },
        "module_constraints":{ "type": "array" },
        "safety_controls":   { "type": "object" },
        "eval_requirements": { "type": "object" },
        "token_constraints": { "type": "object" }
      }
    },
    "architecture_pattern": { "type": "object" },
    "prompt_standards":     { "type": "object" },
    "memory_architecture":  { "type": "object" },
    "token_budget":         { "type": "object" },
    "eval_framework":       { "type": "object" },
    "safety_controls":      { "type": "object" },
    "agent_checklist":      { "type": "array", "items": { "type": "string" } },
    "metadata": {
      "type": "object",
      "required": ["inferred_agent_type","safety_level","model_providers","version"],
      "properties": {
        "inferred_agent_type": { "type": "string" },
        "safety_level":        { "type": "string" },
        "model_providers":     { "type": "array" },
        "version":             { "type": "string" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type","from_skill","reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate","info","warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Rules & Constraints

- `domain_context.domain_primary` MUST be `"ai_agent"` — any other value causes skill rejection with an error feedback.
- This skill is **advisory only** — it does not write code, architecture, or tests. It produces constraints consumed by skills that do.
- `safety_level: "high"` MUST be explicitly declared in input — it is never auto-promoted. The default is `"standard"`.
- The `domain_constraints` output is the **only** output consumed by downstream skills. Other fields are human-readable context.
- Max loop iterations (10) and max concurrent agents (10) are hard constraints — downstream skills must respect these values.
- For `fine_tuned` agent systems, this skill does NOT produce training pipelines — it defines requirements for them. Actual training is out of scope.
- Model provider names must match the defined enum — "gpt-4" is not valid; use "openai".
- `agent_checklist` is passed to the builder agent as a pre-implementation verification gate.

---

## 8. Security Considerations

- **Prompt injection is a first-class security concern** for all AI systems. The `injection_patterns` list must be provided to `security-guard` (SKL-041) which adds `prompt_injection_open` as a non-bypassable block condition.
- For `safety_level: "high"`: all conversation history stored externally must comply with the applicable compliance framework (GDPR conversation deletion, HIPAA BAA, etc.).
- Tool permissions: write-capable tools must never be granted to agents without an explicit human approval step in the tool call flow.
- Model API keys must use scoped permissions (per-environment, per-model, rate-limited) — never shared or broad-access keys.
- Embedding models trained on user data create a data retention obligation — document the embedding model provider's data policy.
- If using third-party AI safety classifiers, their latency and availability must be included in the P95 latency SLA.

---

## 9. Token Optimization

- Load only `requirements.statement` and `requirements.type` fields — skip `id` and `priority` for agent type inference (Step 1).
- Architecture patterns are pre-templated — only module selection and constraint values are LLM-inferred.
- Prompt standards are template-driven — injection patterns are a fixed list, not LLM-generated.
- Token budget calculations use fixed formulas (context_window × ratio) — no LLM call needed.
- Eval framework is selected from a menu of pre-defined eval types — not free-form generation.
- `agent_checklist` is assembled from pre-defined items filtered by agent_system_type.

---

## 10. Quality Checklist

- [ ] `domain_context.domain_primary == "ai_agent"` verified before proceeding
- [ ] `agent_system_type` is inferred or provided — never left as "unknown" in output
- [ ] Architecture pattern selected and all required modules listed
- [ ] Max loop iteration limit specified in `module_constraints`
- [ ] Prompt injection patterns defined (minimum 10 patterns)
- [ ] Memory architecture specifies context window budget per memory type
- [ ] Token budget covers all cost components (input + output + tools + context)
- [ ] Eval framework includes at least one safety eval (prompt injection resistance)
- [ ] For `safety_level: "high"`: secondary safety model, disclaimers, and zero-hallucination policy all present
- [ ] `domain_constraints` object has all required fields
- [ ] `agent_checklist` is non-empty (minimum 10 items)
- [ ] Output is valid JSON

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `domain_context.domain_primary != "ai_agent"` | Reject with error feedback; do not produce domain_constraints |
| `agent_system_type` cannot be inferred from requirements | Set `inferred_agent_type: "single_agent"` (safest default); emit warning in feedback |
| Unknown `model_providers` entry | Accept but emit warning; use generic token budget estimates |
| `safety_level: "high"` declared but requirements contain no compliance signals | Emit warning: "High safety level declared but no compliance requirements detected — verify this is intentional" |
| Requirements contain 0 functional requirements | Cannot infer system purpose; return `action: ask_clarification` equivalent via feedback backpropagate to requirement-analyzer |

---

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Safety level confirmation | `safety_level: "high"` | 3600s | Present safety controls list to stakeholder; confirm the additional controls are acceptable before architecture proceeds |
| Agent system type confirmation | `inferred_agent_type` differs significantly from stated requirements | 3600s | Surface inferred type with evidence; confirm before architecture-design proceeds |

---

## 13. Skill Composition

`ai-agent-specialist` runs in **phase-2c** (domain specialist layer), in parallel with `architecture-design` completing its second pass. It consumes requirements and produces `domain_constraints` fed into downstream skills:

```yaml
name: phase-2c-domain-specialist
composes:
  - skill: ai-agent-specialist
    version: "^1.0.0"
    condition: "domain_context.domain_primary == 'ai_agent'"
    input_map:
      requirements:      "requirement_analyzer_output.requirements"
      architecture:      "architecture_design_output"         # may be null on first pass
      domain_context:    "domain_context"
      safety_level:      "session_context.safety_level"
      model_providers:   "session_context.model_providers"
    output_map:
      domain_constraints: "ai_domain_constraints"             # consumed by downstream skills
```

`domain_constraints` is passed to:
- `architecture-design` (SKL-002) → informs module design, integration patterns, non-determinism handling
- `testing-strategy` (SKL-005) → activates AI eval framework requirements
- `code-generator` (SKL-026) → enforces prompt template structure, safety control injection
- `security-guard` (SKL-041) → adds `prompt_injection_open` as non-bypassable block condition

### Implementation Checklist (emitted in `agent_checklist`)

```
AI Agent Implementation Checklist:
[ ] LLMClient has retry logic with exponential backoff (max 3 retries)
[ ] Max loop/recursion iterations enforced (never unbounded)
[ ] All tool calls logged with full input/output before execution
[ ] Write-capable tools require confirmation step
[ ] Prompt injection detection active on all user inputs
[ ] LLM output passes through safety filter before returning to user
[ ] Context window utilization monitored per request (alert if > 85%)
[ ] Token cost logged per interaction
[ ] Prompt templates version-controlled alongside code
[ ] Eval suite runs on every model/prompt version change
[ ] Graceful degradation returns safe fallback (not raw error) to user
[ ] Rate limiting applied per user/session
[ ] Conversation history respects data retention policy
[ ] Human escalation path exists (confidence threshold defined)
[ ] No hardcoded model API keys (use environment variable injection)
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-18 | Initial release — 8-step domain specialist covering agent architecture patterns, prompt engineering, memory architecture, token budgets, eval framework, and AI safety controls |

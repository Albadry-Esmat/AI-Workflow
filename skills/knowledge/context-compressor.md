# Context Compressor — Knowledge Reference

## Principles

- **Semantic preservation over token reduction**: Compression that drops decision-critical information is worse than no compression. The measure of good compression is whether downstream skills can make the same decisions from the compressed output as from the original.
- **Lossless fields are never compressed**: Some fields must survive compression intact: `session_id`, `open_questions`, `public_api` definitions, `error_messages`, and `security_findings`. These fields are immutable under compression.
- **Compression ratio as a quality signal**: A compression ratio < 0.3 (output is < 30% of input size) should be treated as a warning — significant compression may have dropped important content.
- **Credential scanning before compression**: Input content is scanned for credential patterns before processing. Content containing credentials is rejected, not compressed. Compression must not move credentials further into the pipeline.
- **Idempotent compression**: Compressing already-compressed content should not change it. The output of one compression pass is stable under a second pass.

## Compression Strategies by Content Type

| Content Type | Strategy | Lossless Fields |
|-------------|---------|----------------|
| Requirements | Retain: id, title, acceptance_criteria. Drop: elaboration, examples, notes | id, acceptance_criteria |
| Architecture modules | Retain: name, public_api, dependencies. Drop: rationale prose, diagrams | public_api |
| Feature plans | Retain: task id, status, dependencies. Compress: task bodies to 1-sentence summaries | status |
| Test results | Retain: failed tests only. Drop: passed test bodies | error messages |
| Code map | Retain: path + module assignment + change_hash. Drop: file contents | path |
| Conversation history | Retain: decisions made, open questions, last 3 turns. Drop: everything else | open_questions |

## Token Budget Tiers (reference)

| Tier | Max Tokens (in + out) | When Compressor Activates |
|------|----------------------|-----------------------------|
| Quick | 16K | Remaining < 4K |
| Deep | 32K | Remaining < 8K |
| Partial pipeline | 64K | Remaining < 12K |
| Full pipeline | 128K | Remaining < 24K |

## Anti-patterns

- **Eager compression**: Running the compressor at the start of every skill invocation "just to be safe." Compression has a cost and a fidelity risk. Only compress under budget pressure.
- **Compressing security state**: The security_state scope is read-only by all skills except security-review. Compressing it could hide open findings from the security review gate.
- **Compression without audit**: Dropping content without recording what was dropped in the `dropped_keys` output field. Silent compression creates invisible information loss.
- **Re-compression loops**: context-compressor being triggered by its own output (because the compressed output still exceeds budget). The compressor must always produce output below the budget threshold.

## Source References

- Summarization quality evaluation (ROUGE metric, BERTScore)
- Long-context window management in LLM-based agents
- Information bottleneck theory (Tishby et al.)

"use client";
import { motion } from "framer-motion";
import { Database, Network, Clock, FileSearch, Activity } from "lucide-react";

const CONTEXT_LAYERS = [
  {
    layer: "L1 — In-Context Window",
    desc: "Active session messages and current pipeline state. Lives in the LLM context, cleared between sessions.",
    capacity: "~200K tokens",
    icon: Clock,
    color: "text-cyan-400",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
  },
  {
    layer: "L2 — Structured Session State",
    desc: "Persistent pipeline execution state stored in session_state.json. Survives session boundaries. Covers pipeline progress, ADRs, and skill outputs.",
    capacity: "Unlimited (JSON file)",
    icon: Database,
    color: "text-violet-400",
    border: "border-violet-500/30",
    bg: "bg-violet-500/10",
  },
  {
    layer: "L3 — Knowledge Graph (Graphify)",
    desc: "AST-level code graph spanning your entire codebase. Cross-file relationships, community clusters, and semantic navigation — no vector DB required.",
    capacity: "Full codebase",
    icon: Network,
    color: "text-teal-400",
    border: "border-teal-500/30",
    bg: "bg-teal-500/10",
  },
  {
    layer: "L4 — Behavioral Telemetry Buffer",
    desc: "PII-free ring buffer capturing skill latency, HITL outcomes, and token usage per session. Capped at 500 events. Feeds session-insights analysis at pipeline completion.",
    capacity: "≤500 events/session",
    icon: Activity,
    color: "text-yellow-400",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
  },
];

const DISCOVERY_STEPS = [
  { step: "1", label: "Check session state", desc: "Load session_state.json if a prior session exists for this feature" },
  { step: "2", label: "Query the graph",    desc: 'Run `graphify query "<feature>"` — returns a scoped subgraph, not the entire codebase' },
  { step: "3", label: "Load skill specs",   desc: "Mount required SKILL.md files for this pipeline into context" },
  { step: "4", label: "Evaluate pressure",  desc: "If token budget > 80%, trigger context-compressor before proceeding" },
];

export function BackgroundProcessingSection() {
  return (
    <section className="mb-24">
      {/* Section header */}
      <div className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono"
        >
          Step 3
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Background Processing
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          Before any agent acts, the orchestrator assembles a targeted context window —
          pulling only the relevant slice of project knowledge using a four-layer memory architecture.
        </motion.p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Memory layers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CONTEXT_LAYERS.map((layer, i) => (
            <motion.div
              key={layer.layer}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`rounded-xl border ${layer.border} ${layer.bg} p-5`}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                <layer.icon size={16} className={layer.color} />
              </div>
              <div className={`font-mono text-xs font-bold ${layer.color} mb-1`}>{layer.layer}</div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">{layer.desc}</p>
              <div className="rounded-md bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {layer.capacity}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Context discovery flow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <FileSearch size={15} className="text-zinc-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Context Discovery Sequence</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DISCOVERY_STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-4 h-full">
                  <div className="font-mono text-xs font-bold text-zinc-500 mb-1">Step {s.step}</div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-white mb-1.5">{s.label}</div>
                  <div className="text-xs text-zinc-500 leading-relaxed">{s.desc}</div>
                </div>
                {i < DISCOVERY_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-3 text-zinc-400 dark:text-zinc-700 text-xs text-center">→</div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-3">
            <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre overflow-x-auto">{`# Graphify retrieval — targeted, not full-scan
graphify query "payment gateway"
# → returns a scoped subgraph, not the entire codebase

graphify path "UserService" "PaymentGateway"
# → shows the exact dependency chain between modules`}</pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

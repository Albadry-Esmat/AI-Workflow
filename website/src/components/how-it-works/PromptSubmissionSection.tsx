"use client";
import { motion } from "framer-motion";
import { MessageSquare, Route, AlertCircle, CheckCircle2 } from "lucide-react";

const ROUTING_EXAMPLES = [
  {
    prompt: "Analyze requirements for a payment gateway",
    pipeline: "requirements-only",
    entry: "analyzer",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  {
    prompt: "Design the architecture for a real-time notification system",
    pipeline: "architecture-only",
    entry: "architect",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
  },
  {
    prompt: "Build a user authentication system with JWT and RBAC",
    pipeline: "full-pipeline",
    entry: "analyzer",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
  },
  {
    prompt: "Review this code for SOLID violations",
    pipeline: "quick-review",
    entry: "reviewer",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
];

const NORMALIZER_STEPS = [
  { icon: MessageSquare,  label: "Prompt received",        detail: "Raw natural language input from user"               },
  { icon: AlertCircle,    label: "Ambiguity check",         detail: "prompt-normalizer validates intent clarity"         },
  { icon: Route,          label: "Intent routing",           detail: "Matched against routing table → pipeline selected"  },
  { icon: CheckCircle2,   label: "Pipeline dispatched",     detail: "Entry agent initialized with correct skill binding"  },
];

export function PromptSubmissionSection() {
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
          Step 2
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Prompt Submission
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          You describe what you want in plain language. The orchestrator normalizes your input,
          detects intent, and dispatches the right pipeline — before any AI agent does any work.
        </motion.p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: normalizer flow */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-6"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-5 text-sm">Step 0 — Prompt Normalization</h3>
          <div className="space-y-3">
            {NORMALIZER_STEPS.map(({ icon: Icon, label, detail }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <Icon size={13} className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">{label}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">{detail}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
            If intent is ambiguous, the pipeline halts here and asks the user to clarify before proceeding.
          </div>
        </motion.div>

        {/* Right: routing examples */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="space-y-3"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-4">Prompt → Pipeline Routing Examples</h3>
          {ROUTING_EXAMPLES.map((ex, i) => (
            <motion.div
              key={ex.pipeline + i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-lg border ${ex.border} ${ex.bg} p-4`}
            >
              <p className="text-xs text-zinc-700 dark:text-zinc-300 mb-2 italic">&ldquo;{ex.prompt}&rdquo;</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-mono text-xs ${ex.color}`}>→ {ex.pipeline}</span>
                <span className="text-zinc-400 dark:text-zinc-700 text-xs">·</span>
                <span className="text-xs text-zinc-500">entry: <span className="text-zinc-700 dark:text-zinc-300">{ex.entry}</span></span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

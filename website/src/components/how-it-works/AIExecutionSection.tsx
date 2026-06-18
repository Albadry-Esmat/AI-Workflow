"use client";
import { motion } from "framer-motion";
import { Brain, FileText, RefreshCw, HardDrive } from "lucide-react";

const EXECUTION_PHASES = [
  {
    phase: "Requirements",
    agent: "analyzer",
    model: "claude-sonnet-4.6",
    input: "Raw feature description",
    output: "Structured requirement objects with acceptance criteria",
    color: "from-violet-600 to-violet-500",
    accent: "text-violet-400",
  },
  {
    phase: "Architecture",
    agent: "architect",
    model: "claude-sonnet-4.6",
    input: "Validated requirements",
    output: "Module boundaries, data flow contracts, ADR records",
    color: "from-cyan-600 to-cyan-500",
    accent: "text-cyan-400",
  },
  {
    phase: "Planning",
    agent: "planner",
    model: "claude-sonnet-4.6",
    input: "Architecture + dependency graph",
    output: "Task graph with effort estimates and milestones",
    color: "from-blue-600 to-blue-500",
    accent: "text-blue-400",
  },
  {
    phase: "Code Generation",
    agent: "builder",
    model: "claude-sonnet-4.6",
    input: "Architecture modules + feature plan",
    output: "Implementation files, interface stubs, scaffolding",
    color: "from-teal-600 to-teal-500",
    accent: "text-teal-400",
  },
  {
    phase: "Test Generation",
    agent: "test-generator",
    model: "gpt-4o-mini",
    input: "Code artifacts + testing strategy",
    output: "Unit tests, integration tests, edge-case suites",
    color: "from-green-600 to-green-500",
    accent: "text-green-400",
  },
  {
    phase: "Documentation",
    agent: "doc-maintainer",
    model: "gpt-4o-mini",
    input: "All pipeline outputs",
    output: "Updated docs — async, never blocks pipeline",
    color: "from-pink-600 to-pink-500",
    accent: "text-pink-400",
  },
];

const OUTPUT_TYPES = [
  { label: "Requirement Objects",    icon: FileText,      color: "text-violet-400" },
  { label: "Architecture ADRs",      icon: Brain,         color: "text-cyan-400"   },
  { label: "Implementation Code",    icon: FileText,      color: "text-teal-400"   },
  { label: "Test Suites",            icon: RefreshCw,     color: "text-green-400"  },
  { label: "Session State Snapshot", icon: HardDrive,  color: "text-zinc-400"   },
];

export function AIExecutionSection() {
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
          Step 5
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          AI Execution Flow
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          Each phase produces structured artifacts that become the inputs for the next.
          Complex reasoning agents use Claude Sonnet; utility tasks use GPT-4o-mini to minimize cost.
        </motion.p>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Execution chain */}
        <div className="space-y-3">
          {EXECUTION_PHASES.map((p, i) => (
            <motion.div
              key={p.phase}
              initial={{ opacity: 0, x: i % 2 === 0 ? -12 : 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="grid grid-cols-[auto_1fr] gap-4 items-start"
            >
              {/* Phase badge */}
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className="text-xs font-bold text-white">{String(i + 1).padStart(2, "0")}</span>
              </div>

              {/* Phase content */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-white text-sm">{p.phase}</span>
                    <span className="text-xs text-zinc-500">agent: <span className="text-zinc-700 dark:text-zinc-300">{p.agent}</span></span>
                  </div>
                  <span className={`font-mono text-xs ${p.accent} rounded-full border border-current/20 bg-current/5 px-2 py-0.5`}>
                    {p.model}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-600 uppercase tracking-wide text-[10px] font-semibold">Input</span>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{p.input}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-600 uppercase tracking-wide text-[10px] font-semibold">Output</span>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{p.output}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Output types */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-6"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-4">Artifacts Written to Session State After Each Phase</h3>
          <div className="flex flex-wrap gap-3">
            {OUTPUT_TYPES.map(({ label, icon: Icon, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 px-3 py-2"
              >
                <Icon size={13} className={color} />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{label}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-3">
            All artifacts are written to <span className="font-mono text-zinc-600 dark:text-zinc-400">session_state.json</span> in parallel after each phase,
            ensuring recovery is possible from any point in the pipeline.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

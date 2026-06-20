"use client";
import { motion } from "framer-motion";

const STATE_SCOPES = [
  {
    key: "project_spec",
    label: "Project Spec",
    subtitle: "What you want to build",
    color: "text-violet-400 border-violet-500/20 bg-violet-500/10",
    owner: "requirement-analyzer",
  },
  {
    key: "architecture",
    label: "Architecture",
    subtitle: "Module boundaries and data flow",
    color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
    owner: "architecture-design",
  },
  {
    key: "dependency_graph",
    label: "Dependency Graph",
    subtitle: "Which skills depend on which",
    color: "text-blue-400 border-blue-500/20 bg-blue-500/10",
    owner: "dependency-analyzer",
  },
  {
    key: "task_graph",
    label: "Task Graph",
    subtitle: "Ordered work items with estimates",
    color: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
    owner: "feature-planning",
  },
  {
    key: "code_map",
    label: "Code Map",
    subtitle: "Generated files and their origins",
    color: "text-teal-400 border-teal-500/20 bg-teal-500/10",
    owner: "code-generator",
  },
  {
    key: "test_state",
    label: "Test State",
    subtitle: "Coverage and pass/fail status",
    color: "text-green-400 border-green-500/20 bg-green-500/10",
    owner: "test-generator",
  },
  {
    key: "security_state",
    label: "Security State",
    subtitle: "Findings and boundary violations",
    color: "text-red-400 border-red-500/20 bg-red-500/10",
    owner: "security-review",
  },
  {
    key: "decision_log",
    label: "Decision Log",
    subtitle: "Immutable record of every ADR",
    color: "text-amber-400 border-amber-500/20 bg-amber-500/10",
    owner: "adr-generator",
  },
  {
    key: "pipeline_state",
    label: "Pipeline State",
    subtitle: "Current phase and execution cursor",
    color: "text-orange-400 border-orange-500/20 bg-orange-500/10",
    owner: "orchestrator",
  },
  {
    key: "snapshots",
    label: "Snapshots",
    subtitle: "Pre-change state saves for rollback",
    color: "text-pink-400 border-pink-500/20 bg-pink-500/10",
    owner: "state-manager",
  },
  {
    key: "behavioral_telemetry",
    label: "Telemetry",
    subtitle: "PII-free session telemetry ring buffer",
    color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
    owner: "behavioral-telemetry-collector",
  },
  {
    key: "adaptation_proposals",
    label: "Proposals",
    subtitle: "HITL-pending improvement proposals",
    color: "text-lime-400 border-lime-500/20 bg-lime-500/10",
    owner: "adaptive-proposal-generator",
  },
];

export function StateDiagram() {
  return (
    <section className="mb-20">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 text-center">System State Model</h2>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center mb-10">
        One structured state file governs all operations. Only{" "}
        <code className="text-cyan-400 font-mono text-xs">state-manager</code> can write to it.
        Every agent reads only the slice it needs.
      </p>

      {/* State manager center */}
      <div className="flex justify-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-xl border-2 border-zinc-400/40 dark:border-zinc-500/40 bg-zinc-100/60 dark:bg-zinc-800/60 px-8 py-4 text-center"
        >
          <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500 mb-1">sole write interface</div>
          <div className="font-bold text-zinc-900 dark:text-white text-lg">state-manager</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">read · write · diff · snapshot · restore</div>
        </motion.div>
      </div>

      {/* Scopes grid */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      >
        {STATE_SCOPES.map((scope) => (
          <motion.div
            key={scope.key}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
            whileHover={{
              boxShadow: "0 0 16px 2px rgba(100,200,255,0.10)",
              transition: { duration: 0.2 },
            }}
            className={`rounded-lg border p-3 ${scope.color}`}
          >
            <div className="font-semibold text-sm mb-0.5">{scope.label}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-1.5 leading-snug">{scope.subtitle}</div>
            <div className="font-mono text-xs text-zinc-400 dark:text-zinc-600">{scope.key}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">owner: {scope.owner}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

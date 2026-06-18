"use client";
import { motion } from "framer-motion";
import { Bot, ArrowRight, Cpu } from "lucide-react";

// Exact agents from opencode.json (12 non-primary + primary shown separately)
const AGENTS = [
  { id: "analyzer",        label: "Analyzer",        color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  skill: "requirement-analyzer",    extra: 0 },
  { id: "architect",       label: "Architect",       color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    skill: "architecture-design",     extra: 2 },
  { id: "planner",         label: "Planner",         color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    skill: "feature-planning",        extra: 0 },
  { id: "reviewer",        label: "Reviewer",        color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   skill: "clean-code-review",       extra: 6 },
  { id: "tester",          label: "Tester",          color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30",   skill: "testing-strategy",        extra: 0 },
  { id: "builder",         label: "Builder",         color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30",    skill: "code-generator",          extra: 3 },
  { id: "impact-analyzer", label: "Impact Analyzer", color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  skill: "change-impact-analyzer",  extra: 1 },
  { id: "test-generator",  label: "Test Generator",  color: "text-lime-400",    bg: "bg-lime-500/10",    border: "border-lime-500/30",    skill: "test-generator",          extra: 0 },
  { id: "deployer",        label: "Deployer",        color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  skill: "deployment-strategy",     extra: 0 },
  { id: "recovery",        label: "Recovery",        color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    skill: "rollback-manager",        extra: 0 },
  { id: "documenter",      label: "Documenter",      color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30",    skill: "documentation-generator", extra: 0 },
  { id: "doc-maintainer",  label: "Doc Maintainer",  color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", skill: "doc-maintainer",          extra: 0 },
];

const DECOMP_STEPS = [
  { label: "Phase identified",     desc: "Orchestrator maps the prompt to a pipeline phase" },
  { label: "Skill resolved",       desc: "Registry lookup returns the correct SKILL.md"    },
  { label: "Agent assigned",       desc: "Agent with matching skill binding is selected"    },
  { label: "Inputs validated",     desc: "Schema check: required inputs present and typed"  },
  { label: "Agent dispatched",     desc: "Agent invoked with scoped context + skill spec"   },
];

export function OrchestrationSection() {
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
          Step 4
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Skill &amp; Agent Orchestration
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          The orchestrator decomposes the pipeline into phases, resolves the correct skill and agent
          for each phase, validates inputs, and dispatches agents in the right order — automatically.
        </motion.p>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Agent grid */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-4 text-center">
            13 Agents — Exact bindings from opencode.json
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AGENTS.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-xl border ${agent.border} ${agent.bg} p-4 flex items-start gap-3`}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <Bot size={13} className={agent.color} />
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${agent.color} mb-0.5`}>{agent.label}</div>
                  <div className="font-mono text-xs text-zinc-500 dark:text-zinc-500 truncate">{agent.skill}</div>
                  {agent.extra > 0 && (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-0.5">+{agent.extra} more skills</div>
                  )}
                </div>
              </motion.div>
            ))}
            {/* Orchestrator (special) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: AGENTS.length * 0.06 }}
              className="rounded-xl border border-zinc-400 dark:border-zinc-600 bg-zinc-200/60 dark:bg-zinc-800/60 p-4 flex items-start gap-3 col-span-2 sm:col-span-1"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-300 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600">
                <Cpu size={13} className="text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white mb-0.5">Primary</div>
                <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400">orchestrator agent</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Decomposition flow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-6"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-5">Per-Phase Dispatch Sequence</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
            {DECOMP_STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 px-3 py-2 text-center min-w-[110px]"
                >
                  <div className="font-mono text-xs text-zinc-500 mb-0.5">{String(i + 1).padStart(2, "0")}</div>
                  <div className="text-xs font-medium text-zinc-900 dark:text-white">{s.label}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5 leading-tight hidden sm:block">{s.desc}</div>
                </motion.div>
                {i < DECOMP_STEPS.length - 1 && (
                  <ArrowRight size={13} className="text-zinc-400 dark:text-zinc-700 shrink-0 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

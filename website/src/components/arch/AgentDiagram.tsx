"use client";
import { motion } from "framer-motion";
import type { AgentConfig } from "@/lib/data";

const AGENT_COLORS: Record<string, string> = {
  primary:          "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  analyzer:         "border-violet-500/30 bg-violet-500/10 text-violet-300",
  architect:        "border-blue-500/30 bg-blue-500/10 text-blue-300",
  planner:          "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  reviewer:         "border-amber-500/30 bg-amber-500/10 text-amber-300",
  tester:           "border-green-500/30 bg-green-500/10 text-green-300",
  builder:          "border-teal-500/30 bg-teal-500/10 text-teal-300",
  "impact-analyzer":"border-pink-500/30 bg-pink-500/10 text-pink-300",
  "test-generator": "border-lime-500/30 bg-lime-500/10 text-lime-300",
  deployer:         "border-orange-500/30 bg-orange-500/10 text-orange-300",
  documenter:       "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  "doc-maintainer": "border-rose-500/30 bg-rose-500/10 text-rose-300",
  recovery:         "border-red-500/30 bg-red-500/10 text-red-300",
};

interface Props { agents: AgentConfig }

export function AgentDiagram({ agents }: Props) {
  const agentList = Object.entries(agents);
  const [primary, ...subagents] = agentList.filter(([k]) => k === "primary")
    .concat(agentList.filter(([k]) => k !== "primary"));

  return (
    <section className="mb-20">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Multi-Agent Layer</h2>
      <p className="text-zinc-400 text-sm text-center mb-10">
        Agents are thin executors — all intelligence lives in skills. Data is live from <code className="text-cyan-400 font-mono text-xs">opencode.json</code>.
      </p>

      {/* Orchestrator */}
      <div className="flex justify-center mb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`rounded-xl border-2 px-6 py-4 text-center max-w-xs ${AGENT_COLORS["primary"] ?? ""}`}
        >
          <div className="text-xs font-mono text-zinc-500 mb-1">primary · orchestrator</div>
          <div className="font-bold text-white">Orchestrator</div>
          <div className="text-xs mt-1 text-zinc-400 leading-relaxed">
            Controls execution flow, selects skills, approves HITL gates
          </div>
        </motion.div>
      </div>

      {/* Connector */}
      <div className="flex justify-center mb-4">
        <div className="w-px h-8 bg-zinc-700" />
      </div>

      {/* Subagents grid */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {subagents.map(([name, config]) => {
          const color = AGENT_COLORS[name] ?? "border-zinc-700 bg-zinc-800/50 text-zinc-300";
          const skills = config.skills ?? (config.skill ? [config.skill] : []);
          return (
            <motion.div
              key={name}
              variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
              className={`rounded-lg border p-4 ${color}`}
            >
              <div className="font-semibold text-sm capitalize mb-1">{name}</div>
              <div className="text-xs text-zinc-500 leading-relaxed mb-2 line-clamp-2">
                {config.description.split(".")[0]}.
              </div>
              <div className="text-xs font-mono text-zinc-600">
                {skills.length} skill{skills.length !== 1 ? "s" : ""}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

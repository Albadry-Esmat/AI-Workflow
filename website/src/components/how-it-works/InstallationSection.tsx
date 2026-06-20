"use client";
import { motion } from "framer-motion";
import { Terminal, FolderOpen, Settings, GitBranch } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: GitBranch,
    title: "Clone the Repository",
    desc: "The entire ASE-OS skill system is self-contained in one repo — 51 skills, registry files, pipeline templates, and agent config are all included.",
    code: `git clone https://github.com/your-org/AI-Workflow.git
cd AI-Workflow`,
    color: "from-cyan-600 to-cyan-500",
    accent: "border-cyan-500/30 bg-cyan-500/10",
    text: "text-cyan-400",
  },
  {
    num: "02",
    icon: FolderOpen,
    title: "Open in an Agentic Environment",
    desc: "ASE-OS runs inside OpenCode, Claude Code, or any agentic dev environment that supports multi-agent workflows and SKILL.md skill binding.",
    code: `# Open with OpenCode
opencode .

# Or use any compatible agentic IDE`,
    color: "from-violet-600 to-violet-500",
    accent: "border-violet-500/30 bg-violet-500/10",
    text: "text-violet-400",
  },
  {
    num: "03",
    icon: Settings,
    title: "Agents Auto-Initialize",
    desc: "The primary orchestrator reads opencode.json and auto-binds all 13 specialized subagents. No manual wiring — each agent's skill scope is declared in the config.",
    code: `// opencode.json — snippet
{
  "agent": {
    "orchestrator":  { "skill": "orchestrator/SKILL.md" },
    "analyzer":      { "skill": "requirement-analyzer/SKILL.md" },
    "architect":     { "skill": "architecture-design/SKILL.md" },
    // ... 10 more agents
  }
}`,
    color: "from-blue-600 to-blue-500",
    accent: "border-blue-500/30 bg-blue-500/10",
    text: "text-blue-400",
  },
  {
    num: "04",
    icon: Terminal,
    title: "Graph Index Built Automatically",
    desc: "Graphify scans the project AST and builds a 2,234-node knowledge graph. This becomes the project's long-term memory — no embeddings, no vector DB required.",
    code: `# Runs automatically on first open via plugin hook
# graphify-out/ is populated with:
#   graph.json         — full AST graph
#   GRAPH_REPORT.md    — architecture summary
#   wiki/index.md      — navigable docs
graphify update .`,
    color: "from-teal-600 to-teal-500",
    accent: "border-teal-500/30 bg-teal-500/10",
    text: "text-teal-400",
  },
];

export function InstallationSection() {
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
          Step 1
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Project Installation
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          Four commands. The orchestrator, all 51 skills, the knowledge graph, and 13 agents
          are ready in under a minute.
        </motion.p>
      </div>

      {/* Steps */}
      <div className="space-y-6 max-w-3xl mx-auto">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.num}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="grid grid-cols-[auto_1fr] gap-5"
          >
            {/* Left: step + connector */}
            <div className="flex flex-col items-center">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                <s.icon size={16} className="text-white" />
              </div>
              {i < STEPS.length - 1 && (
                <motion.div
                  className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3 origin-top"
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 + 0.3 }}
                />
              )}
            </div>

            {/* Right: content */}
            <div className="pb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-mono text-xs font-bold ${s.text}`}>{s.num}</span>
                <h3 className="font-semibold text-zinc-900 dark:text-white">{s.title}</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">{s.desc}</p>
              <pre className={`rounded-lg border ${s.accent} p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre`}>
                {s.code}
              </pre>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

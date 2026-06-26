"use client";
import { motion } from "framer-motion";
import { REPO_URL, REPO_NAME } from "@/lib/site.config";

interface Props {
  stats?: { totalSkills: number; totalAgents: number };
}

export function GettingStartedSteps({ stats }: Props) {
  const totalSkills = stats?.totalSkills ?? 0;
  const totalAgents = stats?.totalAgents ?? 0;

  const STEPS = [
    {
      step: "01",
      title: "Clone the Repository",
      description: `The full ASE-OS skill system lives in this repository. Clone it to get all ${totalSkills} skills, registry files, pipeline templates, and agent configuration.`,
      code: `git clone ${REPO_URL}\ncd ${REPO_NAME}`,
      color: "from-cyan-600 to-cyan-500",
    },
    {
      step: "02",
      title: "Open in an Agentic Environment",
      description:
        "ASE-OS is designed to run inside OpenCode, Claude Code, Codex, or any agentic dev environment that supports multi-agent workflows and skill binding.",
      code: "# Open with OpenCode\nopencode .",
      color: "from-violet-600 to-violet-500",
    },
    {
      step: "03",
      title: "The Orchestrator Takes Over",
      description: `The primary agent reads opencode.json and loads all skill bindings automatically. All ${totalAgents} agents — including the analyzer, architect, builder, and domain specialists — are initialized and ready.`,
      code: "# opencode.json is the system entry point\n# All agents and skill bindings are declared there",
      color: "from-blue-600 to-blue-500",
    },
    {
      step: "04",
      title: "Start with Requirements",
      description:
        "Describe what you want to build. The orchestrator routes your input through the full pipeline: requirements → architecture → planning → impact analysis → code generation → review → deployment.",
      code: '# Example: describe your feature\n"Build a user authentication system\nwith JWT tokens and role-based access"',
      color: "from-teal-600 to-teal-500",
    },
    {
      step: "05",
      title: "Approve Human Review Gates",
      description:
        "At critical points (after requirements, after architecture, before deployment), the pipeline pauses for your review and approval. You stay in control of every major decision.",
      code: "# Pipeline pauses at:\n# - Requirements validated       (phase 1)\n# - Architecture approved        (phase 2)\n# - UX & database design approved (phase 2b)\n# - Design system approved       (phase 2c)\n# - Roadmap approved             (phase 4)\n# - Security posture approved    (phase 7)\n# - Defect triage (conditional)  (phase 8d)\n# - Final deploy approval        (phase 9)",
      color: "from-amber-600 to-amber-500",
    },
    {
      step: "06",
      title: "Add New Skills",
      description:
        "To extend the system, add a new SKILL.md file, register it in the three registry files, and it becomes part of every future pipeline run. The website updates on next build.",
      code: "# New skill path:\n.opencode/skills/<name>/SKILL.md\n\n# Register in:\nskills/index.yaml\nskills/registry.json\nskills/graph/skill-graph.yaml",
      color: "from-pink-600 to-pink-500",
    },
  ];

  return (
    <div className="space-y-8">
      {STEPS.map((s, i) => (
        <motion.div
          key={s.step}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
          className="grid grid-cols-[auto_1fr] gap-6"
        >
          <div className="flex flex-col items-center">
            <div
              className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}
            >
              {s.step}
            </div>
            {i < STEPS.length - 1 && (
              <motion.div
                className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3 origin-top"
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 + 0.3 }}
              />
            )}
          </div>
          <div className="pb-8">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">{s.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">{s.description}</p>
            <pre className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {s.code}
            </pre>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

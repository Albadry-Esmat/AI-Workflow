import type { Metadata } from "next";
import { GettingStartedSteps } from "@/components/getting-started/GettingStartedSteps";
import { loadSiteStats, loadSkillGraph } from "@/lib/data";

export const metadata: Metadata = {
  title: "Getting Started",
  description: "How to set up and run ASE-OS in your agentic development environment.",
  openGraph: {
    title: "Getting Started — ASE-OS",
    description: "How to set up and run ASE-OS in your agentic development environment.",
    type: "website",
  },
};

export default function GettingStartedPage() {
  const stats = loadSiteStats();
  const graph = loadSkillGraph();
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Getting Started</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          ASE-OS runs inside any agentic development environment. Setup takes minutes —
          the pipeline is operational as soon as you open the project.
        </p>
      </div>

      <GettingStartedSteps stats={stats} />

      {/* Key files reference */}
      <div className="mt-16 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-6">
        <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">Key Files</h2>
        <div className="space-y-2">
          {[
            { path: "opencode.json",                          role: "Agent definitions, skill bindings, event hooks" },
            { path: "skills/index.yaml",                      role: `Central skill registry — all ${stats.totalSkills} skills` },
            { path: "skills/registry.json",                   role: "Execution registry — I/O, orchestration, feedback routes" },
            { path: "skills/graph/skill-graph.yaml",          role: `Skill dependency graph — ${graph.meta.total_nodes} nodes and ${graph.meta.total_edges} edges` },
            { path: "skills/pipelines/full-pipeline.json",    role: `${stats.totalPipelinePhases}-phase pipeline template — the main execution blueprint` },
            { path: ".opencode/skills/<name>/SKILL.md",       role: "Individual skill specifications" },
            { path: "skills/schema/system-state-schema.json", role: "JSON Schema for the complete system state model" },
          ].map(({ path, role }) => (
            <div key={path} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
              <code className="font-mono text-cyan-400 shrink-0">{path}</code>
              <span className="text-zinc-400 dark:text-zinc-500">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

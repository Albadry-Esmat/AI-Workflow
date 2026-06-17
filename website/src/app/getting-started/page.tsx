export const metadata = {
  title: "Getting Started — ASE-OS",
  description: "How to set up and run ASE-OS in your agentic development environment.",
};

export default function GettingStartedPage() {
  const STEPS = [
    {
      step: "01",
      title: "Clone the Repository",
      description: "The full ASE-OS skill system lives in this repository. Clone it to get all 30 skills, registry files, pipeline templates, and agent configuration.",
      code: "git clone <your-repo-url>\ncd AI-Workflow",
      color: "from-cyan-600 to-cyan-500",
    },
    {
      step: "02",
      title: "Open in an Agentic Environment",
      description: "ASE-OS is designed to run inside OpenCode, Claude Code, Codex, or any agentic dev environment that supports multi-agent workflows and skill binding.",
      code: "# Open with OpenCode\nopencode .",
      color: "from-violet-600 to-violet-500",
    },
    {
      step: "03",
      title: "The Orchestrator Takes Over",
      description: "The primary agent reads opencode.json and loads all skill bindings automatically. The 10 subagents (analyzer, architect, builder, etc.) are initialized and ready.",
      code: "# opencode.json is the system entry point\n# All agents and skill bindings are declared there",
      color: "from-blue-600 to-blue-500",
    },
    {
      step: "04",
      title: "Start with Requirements",
      description: "Describe what you want to build. The orchestrator routes your input through the full pipeline: requirements → architecture → planning → impact analysis → code generation → review → deployment.",
      code: '# Example: describe your feature\n"Build a user authentication system\nwith JWT tokens and role-based access"',
      color: "from-teal-600 to-teal-500",
    },
    {
      step: "05",
      title: "Approve HITL Gates",
      description: "At critical points (after requirements, after architecture, before deployment), the pipeline pauses for your review and approval. You stay in control of every major decision.",
      code: "# Gates pause at:\n# - Requirements validated\n# - Architecture approved\n# - Roadmap approved\n# - Security posture approved\n# - Final deploy approval",
      color: "from-amber-600 to-amber-500",
    },
    {
      step: "06",
      title: "Add New Skills",
      description: "To extend the system, add a new SKILL.md file, register it in the three registry files, and it becomes part of every future pipeline run. The website updates on next build.",
      code: "# New skill path:\n.opencode/skills/<name>/SKILL.md\n\n# Register in:\nskills/index.yaml\nskills/registry.json\nskills/graph/skill-graph.yaml",
      color: "from-pink-600 to-pink-500",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Getting Started</h1>
        <p className="text-zinc-400 max-w-xl mx-auto">
          ASE-OS runs inside any agentic development environment. Setup takes minutes — the pipeline is operational as soon as you open the project.
        </p>
      </div>

      <div className="space-y-8">
        {STEPS.map((s, i) => (
          <div key={s.step} className="grid grid-cols-[auto_1fr] gap-6">
            <div className="flex flex-col items-center">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                {s.step}
              </div>
              {i < STEPS.length - 1 && <div className="w-px flex-1 bg-zinc-800 mt-3" />}
            </div>
            <div className="pb-8">
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{s.description}</p>
              <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                {s.code}
              </pre>
            </div>
          </div>
        ))}
      </div>

      {/* Key files reference */}
      <div className="mt-16 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="font-semibold text-white mb-4">Key Files</h2>
        <div className="space-y-2">
          {[
            { path: "opencode.json",                         role: "Agent definitions, skill bindings, event hooks" },
            { path: "skills/index.yaml",                     role: "Central skill registry — every skill's metadata" },
            { path: "skills/registry.json",                  role: "Execution registry — I/O, orchestration, feedback routes" },
            { path: "skills/graph/skill-graph.yaml",         role: "Skill dependency DAG — nodes and edges" },
            { path: "skills/pipelines/full-pipeline.json",   role: "10-phase pipeline template — the execution blueprint" },
            { path: ".opencode/skills/<name>/SKILL.md",      role: "Individual skill specifications" },
            { path: "skills/schema/system-state-schema.json",role: "JSON Schema for the complete system state model" },
          ].map(({ path, role }) => (
            <div key={path} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
              <code className="font-mono text-cyan-400 shrink-0">{path}</code>
              <span className="text-zinc-500">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

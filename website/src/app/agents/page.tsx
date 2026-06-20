import { loadAgentConfig, loadRegistry } from "@/lib/data";
import { AgentsGrid } from "@/components/agents/AgentsGrid";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const agents = loadAgentConfig();
  const count = Object.keys(agents).length;
  return {
    title: "Agents",
    description: `The ${count} ASE-OS agents — each bound to specific skills with defined permissions. Explore the primary orchestrator and every subagent.`,
    openGraph: {
      title: "Agents — ASE-OS",
      description: `Explore all ${count} ASE-OS agents — orchestrator, subagents, skill bindings, and permission model.`,
      type: "website",
    },
  };
}

export default function AgentsPage() {
  const agents = loadAgentConfig();
  const registry = loadRegistry();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400">
          {Object.keys(agents).length} Agents Configured
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Agents</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Agents are thin executors — each is bound to one or more skills and has explicit
          permissions for file editing and tool use. The primary agent is the only one that
          approves HITL gates and routes pipeline decisions.
        </p>
      </div>
      <AgentsGrid agents={agents} registry={registry} />
    </div>
  );
}

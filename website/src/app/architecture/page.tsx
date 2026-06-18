import { loadSkillGraph, loadAgentConfig } from "@/lib/data";
import { AgentDiagram } from "@/components/arch/AgentDiagram";
import { StateDiagram } from "@/components/arch/StateDiagram";
import { GraphOverview } from "@/components/arch/GraphOverview";

export const metadata = {
  title: "Architecture — ASE-OS",
  description: "System architecture: multi-agent layer, system state model, and skill dependency graph.",
};

export default function ArchitecturePage() {
  const graph = loadSkillGraph();
  const agents = loadAgentConfig();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Architecture</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Three interconnected layers: a minimal multi-agent execution layer, a structured system state,
          and a versioned skill dependency graph with {graph.meta.total_nodes} nodes and {graph.meta.total_edges} edges.
        </p>
      </div>
      <AgentDiagram agents={agents} />
      <StateDiagram />
      <GraphOverview graph={graph} />
    </div>
  );
}

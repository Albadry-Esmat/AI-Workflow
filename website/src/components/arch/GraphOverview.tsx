"use client";
import { motion } from "framer-motion";
import type { SkillGraph } from "@/lib/data";
import { DOMAIN_COLORS } from "@/lib/colors";

interface Props { graph: SkillGraph }

export function GraphOverview({ graph }: Props) {
  const domainGroups: Record<string, typeof graph.nodes> = {};
  graph.nodes.forEach((n) => {
    const d = n.domain;
    if (!domainGroups[d]) domainGroups[d] = [];
    domainGroups[d].push(n);
  });

  const edgeTypeCounts = graph.edges.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Skill Dependency Graph</h2>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center mb-4">
        v{graph.meta.version} · {graph.meta.total_nodes} nodes · {graph.meta.total_edges} edges
      </p>

      {/* Edge type legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-10 text-xs text-zinc-500 dark:text-zinc-400">
        {Object.entries(edgeTypeCounts).map(([type, count]) => {
          const label =
            type === "dependency"    ? "depends on" :
            type === "composition"   ? "uses" :
            type === "co_occurrence" ? "often paired with" : type;
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`h-2 w-5 rounded-full ${
                type === "dependency"    ? "bg-cyan-500" :
                type === "composition"   ? "bg-violet-500" :
                type === "co_occurrence" ? "bg-amber-500" : "bg-zinc-500"
              }`} />
              <span>{label}</span>
              <span className="text-zinc-400 dark:text-zinc-600">({count})</span>
            </div>
          );
        })}
      </div>

      {/* Domain groups */}
      <div className="space-y-6">
        {Object.entries(domainGroups).map(([domain, nodes]) => {
          const c = DOMAIN_COLORS[domain] ?? DOMAIN_COLORS["meta"];
          return (
            <motion.div
              key={domain}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={`rounded-xl border ${c.border} ${c.bg} p-5`}
            >
              <div className={`text-sm font-semibold ${c.text} mb-3 capitalize flex items-center gap-2`}>
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {domain}
                <span className="text-zinc-400 dark:text-zinc-500 font-normal text-xs">({nodes.length} skills)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {nodes.map((n) => (
                  <span
                    key={n.id}
                    className="font-mono text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300 px-2 py-1"
                  >
                    <span className="text-zinc-600">{n.id} </span>{n.name}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

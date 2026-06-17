"use client";
import { motion } from "framer-motion";
import { DOMAIN_COLORS } from "@/lib/colors";

interface Props {
  stats: {
    totalSkills: number;
    totalEdges: number;
    totalPipelinePhases: number;
    totalAgents: number;
    registryVersion: string;
    domainCounts: Record<string, number>;
  };
  domains: [string, number][];
}

export function StatsSection({ stats, domains }: Props) {
  const METRICS = [
    { value: stats.totalSkills,         label: "Total Skills",       sub: `Registry v${stats.registryVersion}` },
    { value: stats.totalEdges,          label: "Dependency Edges",   sub: "In skill graph DAG" },
    { value: stats.totalPipelinePhases, label: "Pipeline Phases",    sub: "Full idea-to-deploy" },
    { value: stats.totalAgents,         label: "Agents",             sub: "Thin, skill-bound" },
  ];

  return (
    <section className="border-y border-zinc-800 bg-zinc-900/30 py-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* Main metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl sm:text-5xl font-black font-mono text-white mb-1">
                {m.value}
              </div>
              <div className="text-sm font-medium text-zinc-300">{m.label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{m.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Domain breakdown */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl"
        >
          <p className="text-center text-sm text-zinc-500 mb-6">Skills by domain</p>
          <div className="flex flex-wrap justify-center gap-3">
            {domains.map(([domain, count]) => {
              const c = DOMAIN_COLORS[domain] ?? DOMAIN_COLORS["meta"];
              return (
                <div
                  key={domain}
                  className={`flex items-center gap-2 rounded-full border ${c.border} ${c.bg} px-3 py-1 text-xs font-medium ${c.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                  {domain}
                  <span className="opacity-60">{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Users, Zap, Layers, GitBranch, Brain, Smartphone, Building2, Cpu, Bug, GitMerge, BarChart2, Sparkles } from "lucide-react";
import type { PipelineTemplate } from "@/lib/data";
import { PHASE_COLORS } from "@/lib/colors";

interface Props { pipelines: PipelineTemplate[] }

const TEMPLATE_META: Record<string, { icon: typeof Layers; color: string; bg: string; border: string; badge: string }> = {
  "full-pipeline":                  { icon: Layers,     color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  badge: "Complete"        },
  "consumer-website":               { icon: GitBranch,  color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    badge: "Website"         },
  "developer-portal":               { icon: GitBranch,  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    badge: "Portal"          },
  "admin-panel":                    { icon: GitBranch,  color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  badge: "Admin"           },
  "ai-agent-system":                { icon: Brain,      color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", badge: "AI System"       },
  "mobile-app":                     { icon: Smartphone, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "Mobile"          },
  "saas-platform":                  { icon: Building2,  color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30",     badge: "SaaS"            },
  "iot-embedded":                   { icon: Cpu,        color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  badge: "IoT / Embedded"  },
  "defect-lifecycle":               { icon: Bug,        color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     badge: "Defect"          },
  "change-request":                 { icon: GitMerge,   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   badge: "Change Req"      },
  "insights-adaptation-pipeline":   { icon: BarChart2,  color: "text-lime-400",    bg: "bg-lime-500/10",    border: "border-lime-500/30",    badge: "Adaptation"      },
  "gap-to-skill":                   { icon: Sparkles,   color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    badge: "Gap → Skill"     },
  "pre-deploy":                     { icon: Zap,        color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  badge: "Pre-Deploy"      },
  "quick-review":                   { icon: Zap,        color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   badge: "Review"          },
  "requirements-only":              { icon: Zap,        color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30",   badge: "Requirements"    },
  "architecture-only":              { icon: Zap,        color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30",    badge: "Architecture"    },
};

function PipelineCard({ pipeline }: { pipeline: PipelineTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TEMPLATE_META[pipeline.id] ?? TEMPLATE_META["full-pipeline"];
  const Icon = meta.icon;
  const humanGates = (pipeline.gates ?? []).filter((g) => g.type === "human_approval").length;
  const autoGates  = (pipeline.gates ?? []).filter((g) => g.type !== "human_approval").length;
  const parallelPhases = (pipeline.phases ?? []).filter((p) => p.parallel).length;

  return (
    <motion.div
      layout
      className={`rounded-xl border ${meta.border} bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden`}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${meta.bg}`}>
            <Icon size={16} className={meta.color} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                {pipeline.name.replace(/-/g, " ")}
              </span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${meta.bg} ${meta.color} border ${meta.border}`}>
                {meta.badge}
              </span>
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">v{pipeline.version}</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2 max-w-xl">
              {pipeline.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Quick stats */}
          <div className="hidden sm:flex gap-4 text-xs text-zinc-500 dark:text-zinc-500">
            <span><strong className="text-zinc-700 dark:text-zinc-300">{pipeline.phases.length}</strong> phases</span>
            <span><strong className="text-zinc-700 dark:text-zinc-300">{humanGates}</strong> HITL gates</span>
            {parallelPhases > 0 && (
              <span><strong className="text-cyan-400">{parallelPhases}</strong> parallel</span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-zinc-500 dark:text-zinc-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expandable phase list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-5 pb-5 pt-4">
              {/* Mobile stats */}
              <div className="sm:hidden flex gap-4 text-xs text-zinc-500 dark:text-zinc-500 mb-4">
                <span><strong className="text-zinc-700 dark:text-zinc-300">{pipeline.phases.length}</strong> phases</span>
                <span><strong className="text-zinc-700 dark:text-zinc-300">{humanGates}</strong> HITL</span>
                {autoGates > 0 && <span><strong className="text-zinc-700 dark:text-zinc-300">{autoGates}</strong> auto</span>}
              </div>

              {/* Phase rows */}
              <div className="space-y-1.5">
                {(pipeline.phases ?? []).map((phase, i) => {
                  const gate = (pipeline.gates ?? []).find((g) => g.after_phase === phase.id);
                  const gradient = PHASE_COLORS[i % PHASE_COLORS.length];
                  return (
                    <div key={phase.id}>
                      <div className="flex items-center gap-3 py-1.5">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br ${gradient} text-[10px] font-bold text-white`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{phase.label}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {phase.parallel && (
                            <span className="text-[10px] rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5">
                              parallel
                            </span>
                          )}
                          {phase.async && (
                            <span className="text-[10px] rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5">
                              async
                            </span>
                          )}
                        </div>
                        <div className="hidden md:flex flex-wrap gap-1 ml-auto">
                          {phase.skills.map((s) => (
                            <span
                              key={s.name}
                              className="text-[10px] font-mono rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      {gate && (
                        <div className="ml-8 my-1 flex items-center gap-1.5 text-xs">
                          {gate.type === "human_approval" ? (
                            <>
                              <Users size={10} className="text-amber-400" />
                              <span className="text-amber-400/80">{gate.label}</span>
                            </>
                          ) : (
                            <>
                              <Zap size={10} className="text-zinc-400 dark:text-zinc-500" />
                              <span className="text-zinc-400 dark:text-zinc-500">{gate.label}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recovery policy */}
              {pipeline.recovery && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                  <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                    on failure
                  </span>
                  {pipeline.recovery.on_critical_failure} · max {pipeline.recovery.max_repair_iterations} repair iterations
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PipelinesClient({ pipelines }: Props) {
  const totalPhases = pipelines.reduce((s, p) => s + (p.phases?.length ?? 0), 0);
  const totalGates  = pipelines.reduce((s, p) => s + (p.gates ?? []).filter((g) => g.type === "human_approval").length, 0);

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-10 grid grid-cols-3 gap-4 text-center">
        {[
          { value: pipelines.length, label: "Pipeline templates" },
          { value: totalPhases,      label: "Total phases across all templates" },
          { value: totalGates,       label: "Human approval gates" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 py-5 px-3">
            <div className="text-3xl font-black font-mono text-zinc-900 dark:text-white mb-1">{s.value}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cards */}
      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {pipelines.map((p) => (
          <motion.div
            key={p.id}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          >
            <PipelineCard pipeline={p} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

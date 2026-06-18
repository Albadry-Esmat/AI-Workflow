"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PHASE_COLORS } from "@/lib/colors";
import type { Pipeline } from "@/lib/data";
import { Users, Zap, ChevronDown } from "lucide-react";

interface Props { pipeline: Pipeline }

export function PipelineFlow({ pipeline }: Props) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  return (
    <div className="mb-24">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 text-center">
        How the {pipeline.phases.length}-Phase Pipeline Works
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center mb-10">
        Each phase hands off to the next. Click any phase to see its skills in detail.
        Human review gates pause execution at key decision points.
      </p>

      {/* Visual flow */}
      <div className="relative">
        {/* Static vertical connector */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-zinc-700/60 to-transparent hidden lg:block" />

        {/* Flowing signal dot */}
        <motion.div
          className="absolute hidden lg:block left-1/2 -translate-x-1/2 w-[3px] rounded-full pointer-events-none"
          style={{
            height: "25%",
            top: 0,
            background: "linear-gradient(to bottom, transparent, #22d3ee 50%, transparent)",
            filter: "drop-shadow(0 0 6px #22d3ee)",
          }}
          animate={{ top: ["-25%", "110%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 0.4 }}
        />

        <div className="space-y-4">
          {pipeline.phases.map((phase, i) => {
            const gradient = PHASE_COLORS[i % PHASE_COLORS.length];
            const isParallel = phase.parallel;
            const isAsync = phase.async;
            const isConditional = !!phase.condition;
            const gate = pipeline.gates.find((g) => g.after_phase === phase.id);
            const isExpanded = expandedPhase === phase.id;

            return (
              <div key={phase.id}>
                <motion.div
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4 }}
                  className={`relative flex ${i % 2 === 0 ? "lg:justify-start" : "lg:justify-end"}`}
                >
                  <div
                    className={`w-full lg:w-[46%] rounded-xl border transition-colors overflow-hidden ${
                      isExpanded
                        ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    {/* Phase header — clickable */}
                    <button
                      onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                      className="w-full text-left p-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-xs font-bold text-white`}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                            <span className="font-semibold text-zinc-900 dark:text-white">{phase.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isParallel && (
                            <span className="text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5">
                              parallel
                            </span>
                          )}
                          {isAsync && (
                            <span className="text-xs rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5">
                              async
                            </span>
                          )}
                          {isConditional && (
                            <span className="text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5">
                              conditional
                            </span>
                          )}
                            <ChevronDown
                              size={13}
                              className={`text-zinc-400 dark:text-zinc-500 ml-1 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Skills (collapsed: pill row) */}
                      {!isExpanded && (
                        <div className="flex flex-wrap gap-1.5">
                          {phase.skills.map((s) => (
                            <span
                              key={s.name}
                              className="text-xs font-mono rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-zinc-200 dark:border-zinc-800 px-5 pb-5 pt-3 space-y-3">
                            {phase.skills.map((s) => (
                              <div key={s.name}                               className="flex items-center justify-between gap-3 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 px-3 py-2">
                                <span className="font-mono text-sm text-zinc-700 dark:text-zinc-200">{s.name}</span>
                                <div className="flex items-center gap-2">
                                  {s.async && (
                                    <span className="text-xs rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5">
                                      async
                                    </span>
                                  )}
                                  <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{s.version}</span>
                                  <span className="text-xs text-zinc-400 dark:text-zinc-600">max {s.max_retries} retries</span>
                                </div>
                              </div>
                            ))}
                            {isConditional && (
                              <p className="text-xs text-amber-400/70 font-mono pt-1">
                                condition: {phase.condition}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Center dot */}
                  <div className="absolute hidden lg:flex left-1/2 top-5 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                </motion.div>

                {/* Gate after this phase */}
                {gate && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="my-3 flex justify-center"
                  >
                    <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium border ${
                      gate.type === "human_approval"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                    }`}>
                      {gate.type === "human_approval" ? <Users size={12} /> : <Zap size={12} />}
                      {gate.type === "human_approval" ? "Human Review" : "Automated Check"}: {gate.label}
                      {gate.timeout === 0 && (
                        <span className="ml-1 text-red-400 text-[10px] font-mono">non-bypassable</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

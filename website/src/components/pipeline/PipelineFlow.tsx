"use client";
import { motion } from "framer-motion";
import { PHASE_COLORS, DOMAIN_COLORS } from "@/lib/colors";
import type { Pipeline } from "@/lib/data";
import { CheckCircle, Users, Zap } from "lucide-react";

interface Props { pipeline: Pipeline }

export function PipelineFlow({ pipeline }: Props) {
  return (
    <div className="mb-24">
      <h2 className="text-2xl font-bold text-white mb-10 text-center">
        The {pipeline.phases.length}-Phase Pipeline
      </h2>

      {/* Visual flow */}
      <div className="relative">
        {/* Vertical connector */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-zinc-700 to-transparent hidden lg:block" />

        <div className="space-y-4">
          {pipeline.phases.map((phase, i) => {
            const gradient = PHASE_COLORS[i % PHASE_COLORS.length];
            const isParallel = phase.parallel;
            const isAsync = phase.async;
            const isConditional = !!phase.condition;
            const gate = pipeline.gates.find((g) => g.after_phase === phase.id);

            return (
              <div key={phase.id}>
                <motion.div
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4 }}
                  className={`relative flex ${i % 2 === 0 ? "lg:justify-start" : "lg:justify-end"}`}
                >
                  <div className="w-full lg:w-[46%] rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-600 transition-colors">
                    {/* Phase header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-xs font-bold text-white`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-semibold text-white">{phase.label}</span>
                      </div>
                      <div className="flex gap-1.5">
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
                      </div>
                    </div>

                    {/* Skills in phase */}
                    <div className="flex flex-wrap gap-1.5">
                      {phase.skills.map((s) => (
                        <span
                          key={s.name}
                          className="text-xs font-mono rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>

                    {/* Condition */}
                    {isConditional && (
                      <p className="mt-2 text-xs text-amber-400/70 font-mono">
                        if: {phase.condition}
                      </p>
                    )}
                  </div>

                  {/* Center dot */}
                  <div className="absolute hidden lg:flex left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-zinc-600 bg-zinc-900" />
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
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {gate.type === "human_approval" ? <Users size={12} /> : <Zap size={12} />}
                      {gate.type === "human_approval" ? "HITL Gate" : "Auto Gate"}: {gate.label}
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

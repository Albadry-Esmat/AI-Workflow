"use client";
import { motion } from "framer-motion";
import type { Pipeline } from "@/lib/data";

const PHASE_DESCRIPTIONS: Record<string, string> = {
  "phase-1-requirements": "The requirement-analyzer extracts, normalizes, and validates requirements from raw input. It produces structured requirement objects with acceptance criteria and open questions. A human approval gate follows before any design work begins.",
  "phase-2-architecture": "The architect designs module boundaries, data flow, integration contracts, and technical decisions. The ADR generator runs asynchronously to document every major architectural choice as an immutable record.",
  "phase-3-graph": "The dependency-analyzer builds the module dependency graph from the architecture output. It detects cycles (cross-module cycles are errors; within-module are warnings) and computes transitive ripple effects for any future change.",
  "phase-4-planning": "Feature planning decomposes the architecture into a task graph with dependencies, complexity estimates, and milestones. The human approves the roadmap and full impact surface before any code is written.",
  "phase-5-impact": "Before a single line of code changes, change-impact-analyzer computes the full blast radius: affected modules, breaking API changes, invalidated tests, documentation drift, and security boundary crossings. It determines exactly which downstream skills to invoke.",
  "phase-6-execution": "The code-generator materializes architecture modules and feature plans into working code artifacts — implementation files, interface stubs, and scaffolding. It never invents structure beyond what was specified.",
  "phase-7-quality": "Clean-code review, testing strategy, security review, and test generation run in parallel. This is the non-bypassable quality gate. Security review is mandatory when any security boundary is touched.",
  "phase-8-repair": "If tests fail or the build is broken, code-repair diagnoses the root cause and applies minimal, validated fixes. After max iterations, it escalates to rollback-manager. This phase is skipped entirely when no failures occur.",
  "phase-9-deploy": "Deployment strategy defines environment models, promotion rules, rollback criteria, and feature flags. A human approval gate provides the final sign-off before any environment changes.",
  "phase-10-docs": "Documentation-generator and doc-maintainer run asynchronously to sync all documentation with the current system state. This phase never blocks the pipeline — docs catch up in the background.",
};

interface Props { pipeline: Pipeline }

export function LifecycleSteps({ pipeline }: Props) {
  return (
    <div className="mb-24">
      <h2 className="text-2xl font-bold text-white mb-10 text-center">Phase Breakdown</h2>
      <div className="space-y-6">
        {pipeline.phases.map((phase, i) => (
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-sm font-bold text-zinc-300">
                {String(i + 1).padStart(2, "0")}
              </div>
              {i < pipeline.phases.length - 1 && (
                <div className="hidden md:block w-px flex-1 bg-zinc-800" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-white">{phase.label}</h3>
                <div className="flex gap-1.5">
                  {phase.parallel && <span className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">parallel</span>}
                  {phase.async && <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">async</span>}
                  {phase.condition && <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">conditional</span>}
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                {PHASE_DESCRIPTIONS[phase.id] ?? ""}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {phase.skills.map((s) => (
                  <span key={s.name} className="font-mono text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-2 py-0.5">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

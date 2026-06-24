"use client";
import { motion } from "framer-motion";
import type { Pipeline } from "@/lib/data";

const PHASE_DESCRIPTIONS: Record<string, string> = {
  "phase-1-requirements": "The requirement-analyzer reads your raw input and turns it into structured requirement objects — each with acceptance criteria and flagged open questions. A human approval gate follows before any design work begins.",
  "phase-2-architecture": "The architect designs module boundaries, data flow, and integration contracts. The ADR generator runs in the background to capture every major technical decision as a permanent, immutable record.",
  "phase-2b-design": "The frontend-ux-architect designs user experience flows and component hierarchy. When a design system is required, design-system-generator creates the token files, component stubs, and Storybook configuration from the UX output.",
  "phase-2c-design-system": "The design-system-generator produces the complete design system scaffold from the UX architecture output — token files, component stubs, Storybook configuration, and theme setup. This phase only runs when the project requires a component library or design system.",
  "phase-3-graph": "The dependency-analyzer builds the full module dependency graph. It detects cycles (cross-module cycles fail the build; within-module cycles generate warnings) and calculates exactly which parts of the system are affected by any future change.",
  "phase-4-planning": "Feature planning breaks the architecture into a task graph with dependencies, effort estimates, and milestones. The human approves the full roadmap before a single line of code is written.",
  "phase-5-impact": "Before any code changes, the system calculates the full blast radius: which modules are affected, which API contracts break, which tests are invalidated, where documentation will drift, and whether any security boundaries are crossed.",
  "phase-6-execution": "The code-generator turns architecture modules and feature plans into working implementation files, interface stubs, and scaffolding. It only generates what was specified — nothing is invented.",
  "phase-7-quality": "Code review, testing strategy, security review, and test generation all run in parallel. Security review is mandatory and non-skippable when any security boundary is touched.",
  "phase-7b-guards": "Guard skills run in parallel as a final checklist before the pipeline advances past the quality stage. Five guards run simultaneously: database-guard (destructive migrations, PII), performance-guard (N+1 queries, missing indexes), ui-ux-compliance-guard (design token violations, accessibility), security-guard (CVSS threshold, OWASP), and work-item-lifecycle-guard (invalid work item state transitions). A single block verdict from any one guard halts the pipeline.",
  "phase-8-repair": "If tests fail or the build breaks, code-repair diagnoses the root cause and applies the minimal fix needed. After a maximum number of attempts, it escalates to the rollback manager. This phase is skipped entirely when everything passes.",
  "phase-8b-audit": "The implementation-completeness-auditor cross-checks every requirement against delivered code, tests, UI screens, database entities, and documentation. It produces a readiness score (0–100) and a full traceability matrix. Any gap is classified as missing, stub, untested, or undocumented — and must be resolved before the release gate passes.",
  "phase-8c-release-guard": "The release guard is the final non-bypassable threshold check. It verifies that quality scores, test coverage, and security posture all meet the minimum required thresholds. There is no override path.",
  "phase-8d-defect-management": "The defect-manager triages, prioritizes, and tracks defects and missing implementations found during the release guard or completeness audit. This phase only runs when defects are detected or when required items are missing — otherwise it is skipped entirely.",
  "phase-9-deploy": "Deployment strategy defines environment promotion rules, rollback criteria, and feature flags. A human approval gate provides the final sign-off before any environment is touched.",
  "phase-10-docs": "Documentation-generator and doc-maintainer run asynchronously to sync all docs with the current system state. This phase never blocks the pipeline — documentation catches up in the background.",
  "phase-10b-export": "The work-item-exporter exports the complete task graph to external project management systems as structured work items. This phase runs asynchronously alongside documentation and never blocks the pipeline.",
};

interface Props { pipeline: Pipeline }

export function LifecycleSteps({ pipeline }: Props) {
  return (
    <div className="mb-24">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-10 text-center">Phase Breakdown</h2>
      <div className="space-y-6">
        {pipeline.phases.map((phase, i) => (
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-mono text-sm font-bold text-zinc-600 dark:text-zinc-300">
                {String(i + 1).padStart(2, "0")}
              </div>
              {i < pipeline.phases.length - 1 && (
                <div className="hidden md:block w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{phase.label}</h3>
                <div className="flex gap-1.5">
                  {phase.parallel && <span className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">parallel</span>}
                  {phase.async && <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">async</span>}
                  {phase.condition && <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">conditional</span>}
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                {PHASE_DESCRIPTIONS[phase.id] ?? ""}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {phase.skills.map((s) => (
                  <span key={s.name} className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md px-2 py-0.5">
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

"use client";
import { motion } from "framer-motion";
import { PackageCheck, Book, Rocket, RotateCcw, Users } from "lucide-react";

const DELIVERABLES = [
  {
    icon: PackageCheck,
    title: "Production-Ready Code",
    desc: "Reviewed, tested, and security-cleared implementation files. All specs enforced — nothing invented beyond what was specified.",
    accent: "text-teal-400",
    border: "border-teal-500/30",
    bg: "bg-teal-500/10",
  },
  {
    icon: Book,
    title: "Living Documentation",
    desc: "Auto-generated and synced docs — ADRs, API reference, README, onboarding guide. No documentation drift. Runs asynchronously, never blocks delivery.",
    accent: "text-pink-400",
    border: "border-pink-500/30",
    bg: "bg-pink-500/10",
  },
  {
    icon: Rocket,
    title: "Deployment Artifacts",
    desc: "Deployment strategy, environment promotion rules, feature flags, and IaC scaffold — all generated from the same pipeline run.",
    accent: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
  },
  {
    icon: RotateCcw,
    title: "Rollback Plan",
    desc: "A rollback snapshot is committed to session state before every deployment. One command reverts to the prior known-good state if anything goes wrong.",
    accent: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
];

const APPROVAL_GATES = [
  { label: "Requirements validated",    phase: "After Phase 1",  type: "human" },
  { label: "Architecture approved",     phase: "After Phase 2",  type: "human" },
  { label: "Roadmap approved",          phase: "After Phase 4",  type: "human" },
  { label: "Security posture approved", phase: "After Phase 7",  type: "human" },
  { label: "Release guard passed",      phase: "After Phase 8c", type: "auto"  },
  { label: "Final deploy approval",     phase: "After Phase 9",  type: "human" },
];

export function OutputDeliverySection() {
  return (
    <section className="mb-24">
      {/* Section header */}
      <div className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono"
        >
          Step 7 — 8
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Final Output &amp; Delivery
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          When all gates pass, the pipeline produces four categories of deliverable — and a full
          human approval trail shows every decision point that was reviewed before deployment.
        </motion.p>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Deliverables grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DELIVERABLES.map((d, i) => (
            <motion.div
              key={d.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`rounded-xl border ${d.border} ${d.bg} p-5`}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <d.icon size={16} className={d.accent} />
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white text-sm">{d.title}</div>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{d.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Human approval gate timeline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Users size={15} className="text-zinc-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Human Approval Gates — Full Audit Trail</h3>
          </div>
          <div className="relative space-y-2">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />

            {APPROVAL_GATES.map((gate, i) => (
              <motion.div
                key={gate.label}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative flex items-center gap-3 pl-9"
              >
                {/* Dot */}
                <div className={`absolute left-2.5 h-2 w-2 rounded-full ${
                  gate.type === "human" ? "bg-amber-400" : "bg-green-400"
                }`} />
                <div className="flex items-center gap-3 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2">
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1">{gate.label}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-600 font-mono">{gate.phase}</span>
                  <span className={`text-xs rounded-full border px-2 py-0.5 ${
                    gate.type === "human"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-green-400 bg-green-500/10 border-green-500/20"
                  }`}>
                    {gate.type === "human" ? "human" : "auto"}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

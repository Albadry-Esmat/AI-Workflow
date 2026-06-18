"use client";
import { motion } from "framer-motion";
import { ShieldCheck, TestTube, Eye, Lock, AlertTriangle, CheckCircle } from "lucide-react";

const QA_STAGES = [
  {
    icon: Eye,
    title: "Code Review",
    skill: "clean-code-review",
    agent: "reviewer",
    desc: "Checks SOLID principles, anti-patterns, complexity thresholds, and duplication. Produces a scored report.",
    badge: "parallel",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
  {
    icon: TestTube,
    title: "Testing Strategy & Test Run",
    skill: "testing-strategy + test-generator",
    agent: "tester",
    desc: "Defines test plan and generates full unit/integration/edge-case suites. Coverage must hit the quality gate threshold.",
    badge: "parallel",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    color: "text-green-400",
    border: "border-green-500/30",
    bg: "bg-green-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Security Review",
    skill: "security-review",
    agent: "security",
    desc: "Mandatory and non-skippable when any security boundary is touched. Blocks the pipeline until all findings are resolved.",
    badge: "mandatory",
    badgeColor: "text-red-400 bg-red-500/10 border-red-500/20",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
  },
  {
    icon: AlertTriangle,
    title: "Guard Skills",
    skill: "release-guard + policy-guard",
    agent: "reviewer",
    desc: "Final checklist before leaving the quality stage. Checks rule violations, policy breaches, invariant failures. Returns `{ verdict: 'pass'|'block', violations: [...] }`.",
    badge: "blocking",
    badgeColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    color: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
  },
];

const THRESHOLDS = [
  { label: "Min Quality Score",    value: "85 / 100", color: "text-amber-400"  },
  { label: "Min Test Coverage",    value: "≥ 80%",    color: "text-green-400"  },
  { label: "Security Findings",    value: "0 critical",color: "text-red-400"   },
  { label: "Guard Verdict",        value: "pass",      color: "text-orange-400" },
];

export function QualityAssuranceSection() {
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
          Step 6
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Quality Assurance &amp; Validation
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          Four overlapping QA layers run before any artifact is considered done.
          The release guard is the final non-bypassable threshold check — there is no override path.
        </motion.p>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* QA stages grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QA_STAGES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`rounded-xl border ${s.border} ${s.bg} p-5`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                    <s.icon size={16} className={s.color} />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-white text-sm">{s.title}</div>
                    <div className="font-mono text-xs text-zinc-500">{s.agent}</div>
                  </div>
                </div>
                <span className={`text-xs rounded-full border px-2 py-0.5 ${s.badgeColor}`}>{s.badge}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">{s.desc}</p>
              <div className="font-mono text-xs text-zinc-500">{s.skill}</div>
            </motion.div>
          ))}
        </div>

        {/* Release thresholds */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-900/40 p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Lock size={15} className="text-zinc-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Non-Bypassable Release Thresholds</h3>
            <span className="ml-auto text-xs rounded-full border border-red-500/30 bg-red-500/10 text-red-400 px-2 py-0.5">
              bypass_on_timeout: false
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THRESHOLDS.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-3 text-center"
              >
                <div className={`text-lg font-bold font-mono ${t.color} mb-1`}>{t.value}</div>
                <div className="text-xs text-zinc-500">{t.label}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            <CheckCircle size={13} className="text-green-400 shrink-0" />
            All four thresholds must pass simultaneously. Failure in any one blocks deployment.
          </div>
        </motion.div>
      </div>
    </section>
  );
}

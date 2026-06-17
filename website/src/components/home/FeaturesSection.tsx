"use client";
import { motion } from "framer-motion";
import {
  GitBranch, ShieldCheck, FileCode2, TestTube2,
  BookOpen, RefreshCw, Zap, Lock
} from "lucide-react";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Automatic Architecture Enforcement",
    description: "Every code change is validated against the architecture before execution. Cross-module boundary violations are blocked, not warned.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Zap,
    title: "Event-Driven Propagation",
    description: "A code change automatically triggers code review, test invalidation, documentation sync, and impact analysis — with zero manual steps.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Security by Design",
    description: "Security review is non-bypassable when a change touches auth, session, or data access boundaries. It is an invariant, not a review step.",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    icon: FileCode2,
    title: "Contract-First Code Generation",
    description: "Code is generated from explicit architecture contracts — not from prose. Every generated file is traceable to a module specification.",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
  {
    icon: TestTube2,
    title: "Automated Test Generation",
    description: "Tests are generated from code artifacts and testing strategies. When code changes invalidate tests, new ones are regenerated automatically.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    icon: BookOpen,
    title: "Zero-Drift Documentation",
    description: "Documentation is generated from system state. Every code or architecture change triggers an automatic doc sync — documentation never falls behind.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: RefreshCw,
    title: "Instant Rollback Recovery",
    description: "State snapshots are taken before every mutation. On critical failure, the system rolls back to a known-good state and generates a post-mortem.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: Lock,
    title: "Token Budget Enforcement",
    description: "Hard per-operation token ceilings prevent runaway context costs. Semantic compression kicks in automatically when budget pressure is detected.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-14 text-center"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          What ASE-OS Does For You
        </h2>
        <p className="text-zinc-400 max-w-xl mx-auto">
          Every capability is built-in, automatic, and non-bypassable — not a plugin or an option.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            variants={item}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-200"
          >
            <div className={`mb-3 inline-flex rounded-lg ${f.bg} p-2`}>
              <f.icon size={18} className={f.color} />
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{f.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

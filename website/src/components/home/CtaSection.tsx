"use client";
import { motion } from "framer-motion";
import Link from "next/link";

interface Props {
  stats: { totalSkills: number; totalPipelinePhases: number };
}

export function CtaSection({ stats }: Props) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 dark:from-zinc-900 via-zinc-50 dark:via-zinc-900 to-zinc-100 dark:to-zinc-950 p-12 text-center"
      >
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />
        </div>

        <h2 className="relative text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
          Ready to build with ASE-OS?
        </h2>
        <p className="relative text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto mb-8 leading-relaxed">
          {stats.totalSkills} skills, {stats.totalPipelinePhases} pipeline phases, and a fully wired multi-agent layer — ready to run inside any agentic development environment.
        </p>
        <div className="relative flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/getting-started"
            className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-8 py-3 text-sm font-semibold text-zinc-950 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/skills"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-8 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Browse All Skills
          </Link>
          <Link
            href="/how-it-works"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-8 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            See the Pipeline
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

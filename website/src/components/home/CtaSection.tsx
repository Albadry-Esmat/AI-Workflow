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
          <a
            href="https://github.com/Albadry-Esmat/AI-Workflow"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-8 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </motion.div>
    </section>
  );
}

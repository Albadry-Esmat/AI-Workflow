"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
interface Props {
  stats: { totalSkills: number; totalPipelinePhases: number; totalAgents: number; registryVersion: string };
}

export function HeroSection({ stats }: Props) {
  return (
    <section className="relative overflow-hidden grid-bg min-h-[90vh] flex flex-col items-center justify-center px-6 text-center">
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute h-[400px] w-[400px] rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-4xl"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Skill System v{stats.registryVersion} · {stats.totalSkills} Skills Active
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl sm:text-7xl font-bold tracking-tight mb-6"
        >
          <span className="text-zinc-900 dark:text-white">AI Software</span>
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent gradient-animate">
            Engineering OS
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-2xl text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed"
        >
          A unified, skill-driven system that takes your idea all the way from requirements
          to deployed software — automatically, with no manual wiring and no documentation
          drift.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/getting-started"
            className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/how-it-works"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            See How It Works →
          </Link>
        </motion.div>

        {/* Quick stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-16 flex flex-wrap justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-500"
        >
          {[
            { value: stats.totalSkills,          label: "Skills" },
            { value: stats.totalPipelinePhases,  label: "Pipeline Phases" },
            { value: stats.totalAgents,          label: "Agents" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <AnimatedCounter to={s.value} className="font-mono font-bold text-zinc-700 dark:text-zinc-200 text-base" />
              <span>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-600 text-xs"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="h-4 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full"
        />
        scroll
      </motion.div>
    </section>
  );
}

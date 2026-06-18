"use client";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Zap, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Layers, label: "40 Skills",         desc: "Modular, composable AI skills" },
  { icon: Zap,        label: "14 Pipeline Phases", desc: "Fully automated lifecycle"  },
  { icon: ShieldCheck,label: "Non-bypassable Gates", desc: "Human approval at every key decision" },
];

export function UseCaseHero() {
  return (
    <section className="relative overflow-hidden py-24 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[700px] rounded-full bg-violet-500/5 blur-[140px]" />
        <div className="absolute h-[350px] w-[500px] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          End-to-End Use Case Walkthrough
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6"
        >
          From Idea{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
            to Production
          </span>
          <br />
          in a Single Prompt
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-10"
        >
          Walk through exactly what happens after you describe a feature inside ASE-OS —
          step by step, from the moment you press Enter to the moment tested, reviewed,
          and deployment-ready code lands in your hands.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-16 text-sm text-zinc-500 dark:text-zinc-500"
        >
          <span>Installation</span>
          <ArrowRight size={14} className="text-zinc-400 dark:text-zinc-700" />
          <span>Prompt</span>
          <ArrowRight size={14} className="text-zinc-400 dark:text-zinc-700" />
          <span>Orchestration</span>
          <ArrowRight size={14} className="text-zinc-400 dark:text-zinc-700" />
          <span>AI Execution</span>
          <ArrowRight size={14} className="text-zinc-400 dark:text-zinc-700" />
          <span>Review &amp; QA</span>
          <ArrowRight size={14} className="text-zinc-400 dark:text-zinc-700" />
          <span className="text-cyan-400 font-medium">Delivery</span>
        </motion.div>

        {/* Highlight cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HIGHLIGHTS.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-5 text-left"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <Icon size={16} className="text-cyan-400" />
              </div>
              <div className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">{label}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">{desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

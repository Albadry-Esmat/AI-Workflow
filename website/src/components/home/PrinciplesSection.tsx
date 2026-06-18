"use client";
import { motion } from "framer-motion";

const PRINCIPLES = [
  {
    number: "01",
    title: "Skill-Driven Execution",
    color: "from-cyan-500 to-cyan-400",
    border: "border-cyan-500/20",
    glow: "group-hover:shadow-cyan-500/10",
    description:
      "Every action the system takes runs through a named, versioned Skill — not a freeform prompt. Skills have fixed inputs, fixed outputs, and defined rules. If a capability doesn't have a Skill, it doesn't exist in the system.",
    tags: ["Versioned", "Composable", "Schema-validated"],
  },
  {
    number: "02",
    title: "Event-Driven Architecture",
    color: "from-violet-500 to-violet-400",
    border: "border-violet-500/20",
    glow: "group-hover:shadow-violet-500/10",
    description:
      "When something changes — code, architecture, tests, or docs — the system automatically emits an event and triggers all the right follow-up actions. You never have to manually kick off downstream work.",
    tags: ["Automatic propagation", "Deduplication", "Audit log"],
  },
  {
    number: "03",
    title: "State-Centric Control",
    color: "from-pink-500 to-pink-400",
    border: "border-pink-500/20",
    glow: "group-hover:shadow-pink-500/10",
    description:
      "Everything the system knows lives in one structured state file. Agents can read it, but only the state-manager can write to it. Every change is tracked, versioned, and fully reversible.",
    tags: ["Snapshots", "Rollback", "Single writer"],
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.15 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export function PrinciplesSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 text-center"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
          Three Non-Negotiable Principles
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Every decision in ASE-OS traces back to one of these three foundations.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {PRINCIPLES.map((p) => (
          <motion.div
            key={p.number}
            variants={item}
            className={`group relative rounded-xl border ${p.border} bg-zinc-50/50 dark:bg-zinc-900/50 p-6 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-300 hover:shadow-xl ${p.glow}`}
          >
            <div className={`mb-4 text-4xl font-black bg-gradient-to-br ${p.color} bg-clip-text text-transparent`}>
              {p.number}
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">{p.title}</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-4">{p.description}</p>
            <div className="flex flex-wrap gap-2">
              {p.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

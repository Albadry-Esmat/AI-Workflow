"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Zap, Plus, RefreshCw, Layers } from "lucide-react";
import type { ChangelogSection } from "@/lib/data";

interface Props {
  latestRelease?: ChangelogSection;
  stats: { totalSkills: number; totalEdges: number };
}

// Cycle through a small set of accent icons for the highlight cards
const CARD_STYLES = [
  { icon: Zap,      color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  { icon: Plus,     color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  },
  { icon: RefreshCw,color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20"   },
  { icon: Layers,   color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
];

export function WhatsNewBanner({ latestRelease, stats }: Props) {
  // Collect the first "Added" group items, falling back to any group's items
  const addedGroup =
    latestRelease?.groups.find((g) => g.label.toLowerCase().includes("add")) ??
    latestRelease?.groups[0];
  const highlights = (addedGroup?.items ?? []).slice(0, 4);

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-50 dark:from-violet-950/40 via-zinc-50 dark:via-zinc-900 to-zinc-50 dark:to-zinc-900 p-8"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            {latestRelease && (
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-400 font-medium mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                New in v{latestRelease.version} — {latestRelease.date}
              </div>
            )}
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              What&apos;s New
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1 max-w-lg">
              Latest changes to the skill system —{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {stats.totalSkills} skills
              </span>{" "}
              and{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {stats.totalEdges} dependency edges
              </span>{" "}
              in the graph.
            </p>
          </div>
          <Link
            href="/changelog"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Full Changelog
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Highlight cards — driven from changelog "Added" items */}
        {highlights.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {highlights.map((item, i) => {
              const style = CARD_STYLES[i % CARD_STYLES.length];
              const Icon = style.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`rounded-xl border ${style.border} ${style.bg} p-4`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} className={style.color} />
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{item}</p>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            See the <Link href="/changelog" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">full changelog</Link> for all changes in this release.
          </p>
        )}
      </motion.div>
    </section>
  );
}

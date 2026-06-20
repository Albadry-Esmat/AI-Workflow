"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, RefreshCw, Wrench, ShieldAlert } from "lucide-react";
import type { ChangelogSection } from "@/lib/data";

const GROUP_STYLES: Record<string, { icon: typeof Plus; color: string; bg: string; border: string }> = {
  Added:      { icon: Plus,       color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  },
  Changed:    { icon: RefreshCw,  color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20"   },
  Fixed:      { icon: Wrench,     color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  Security:   { icon: ShieldAlert,color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  Deprecated: { icon: ChevronDown,color: "text-zinc-400",   bg: "bg-zinc-500/10",   border: "border-zinc-700"      },
  Removed:    { icon: ChevronDown,color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20"   },
};

/** Finds the matching GROUP_STYLES entry by exact match first, then prefix.
 *  Handles extended headings like "Added — Lightweight Observability Pipeline". */
function findGroupStyle(label: string) {
  if (GROUP_STYLES[label]) return GROUP_STYLES[label];
  const key = Object.keys(GROUP_STYLES).find((k) => label.startsWith(k));
  return key ? GROUP_STYLES[key] : null;
}

/** Returns the base GROUP_STYLES key for a label (e.g. "Added — Subtitle" → "Added"). */
function findGroupBaseLabel(label: string): string {
  if (GROUP_STYLES[label]) return label;
  const key = Object.keys(GROUP_STYLES).find((k) => label.startsWith(k));
  return key ?? label;
}

function VersionCard({ section, isLatest }: { section: ChangelogSection; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <motion.div
      layout
      className={`rounded-xl border ${isLatest ? "border-violet-500/30" : "border-zinc-200 dark:border-zinc-800"} bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isLatest && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              Latest
            </span>
          )}
          <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
            v{section.version}
          </span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">{section.date}</span>
          <div className="hidden sm:flex gap-1.5">
            {/* Deduplicate by base type (e.g. two "Added — …" groups → one "Added (N)" badge) */}
            {section.groups
              .reduce<Array<{ baseLabel: string; count: number; style: (typeof GROUP_STYLES)[string] }>>(
                (acc, g) => {
                  const style = findGroupStyle(g.label);
                  if (!style) return acc;
                  const baseLabel = findGroupBaseLabel(g.label);
                  const existing = acc.find((b) => b.baseLabel === baseLabel);
                  if (existing) {
                    existing.count += g.items.length;
                  } else {
                    acc.push({ baseLabel, count: g.items.length, style });
                  }
                  return acc;
                },
                [],
              )
              .map((badge, badgeIdx) => {
                const Icon = badge.style.icon;
                return (
                  <span
                    key={`${badge.baseLabel}-${badgeIdx}`}
                    className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border ${badge.style.border} ${badge.style.bg} ${badge.style.color}`}
                  >
                    <Icon size={10} />
                    {badge.baseLabel} ({badge.count})
                  </span>
                );
              })}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 pb-6 pt-5 space-y-5">
              {section.groups.map((group, groupIdx) => {
                const s = findGroupStyle(group.label) ?? GROUP_STYLES["Changed"];
                const Icon = s.icon;
                return (
                  <div key={`${group.label}-${groupIdx}`}>
                    <div className={`flex items-center gap-2 mb-3 text-sm font-semibold ${s.color}`}>
                      <Icon size={14} />
                      {group.label}
                    </div>
                    <ul className="space-y-1.5">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${s.color.replace("text-", "bg-")}`} />
                          <span
                            dangerouslySetInnerHTML={{
                              __html: item
                                // bold **text** — no color class; inherits readable parent color
                                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                // inline code `text`
                                .replace(/`([^`]+)`/g, '<code class="font-mono text-xs text-cyan-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">$1</code>'),
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ChangelogContent({ sections }: { sections: ChangelogSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <motion.div
          key={s.version}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
        >
          <VersionCard section={s} isLatest={i === 0} />
        </motion.div>
      ))}
    </div>
  );
}

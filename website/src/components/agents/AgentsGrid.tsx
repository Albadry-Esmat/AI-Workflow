"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Shield, ShieldOff, Edit2, Terminal } from "lucide-react";
import type { AgentConfig, RegistryEntry } from "@/lib/data";

interface Props {
  agents: AgentConfig;
  registry: RegistryEntry[];
}

const AGENT_COLORS: Record<string, { card: string; badge: string; dot: string }> = {
  primary:           { card: "border-cyan-500/30 bg-cyan-500/5",     badge: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",     dot: "bg-cyan-400"     },
  analyzer:          { card: "border-violet-500/25 bg-violet-500/5", badge: "text-violet-400 bg-violet-500/10 border-violet-500/20", dot: "bg-violet-400"   },
  architect:         { card: "border-blue-500/25 bg-blue-500/5",     badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-400"     },
  planner:           { card: "border-indigo-500/25 bg-indigo-500/5", badge: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", dot: "bg-indigo-400"   },
  reviewer:          { card: "border-amber-500/25 bg-amber-500/5",   badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",   dot: "bg-amber-400"    },
  tester:            { card: "border-green-500/25 bg-green-500/5",   badge: "text-green-400 bg-green-500/10 border-green-500/20",   dot: "bg-green-400"    },
  builder:           { card: "border-teal-500/25 bg-teal-500/5",     badge: "text-teal-400 bg-teal-500/10 border-teal-500/20",     dot: "bg-teal-400"     },
  "impact-analyzer": { card: "border-pink-500/25 bg-pink-500/5",     badge: "text-pink-400 bg-pink-500/10 border-pink-500/20",     dot: "bg-pink-400"     },
  "test-generator":  { card: "border-lime-500/25 bg-lime-500/5",     badge: "text-lime-400 bg-lime-500/10 border-lime-500/20",     dot: "bg-lime-400"     },
  deployer:          { card: "border-orange-500/25 bg-orange-500/5", badge: "text-orange-400 bg-orange-500/10 border-orange-500/20", dot: "bg-orange-400"   },
  documenter:        { card: "border-fuchsia-500/25 bg-fuchsia-500/5",badge: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20", dot: "bg-fuchsia-400" },
  "doc-maintainer":  { card: "border-rose-500/25 bg-rose-500/5",     badge: "text-rose-400 bg-rose-500/10 border-rose-500/20",     dot: "bg-rose-400"     },
  recovery:          { card: "border-red-500/25 bg-red-500/5",       badge: "text-red-400 bg-red-500/10 border-red-500/20",       dot: "bg-red-400"      },
};

function PermissionBadge({ perm, label }: { perm: string; label: string }) {
  const isDeny = perm === "deny";
  const isAsk  = perm === "ask";
  return (
    <span className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border font-mono ${
      isDeny ? "text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50" :
      isAsk  ? "text-amber-400 border-amber-500/20 bg-amber-500/10" :
               "text-green-400 border-green-500/20 bg-green-500/10"
    }`}>
      {isDeny ? <ShieldOff size={9} /> : isAsk ? <Edit2 size={9} /> : <Shield size={9} />}
      {label}:{perm}
    </span>
  );
}

function AgentCard({ name, config, skills, isPrimary }: {
  name: string;
  config: AgentConfig[string];
  skills: string[];
  isPrimary: boolean;
}) {
  const [expanded, setExpanded] = useState(isPrimary);
  const c = AGENT_COLORS[name] ?? { card: "border-zinc-300 dark:border-zinc-700 bg-zinc-100/30 dark:bg-zinc-800/30", badge: "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700", dot: "bg-zinc-400" };

  return (
    <motion.div layout className={`rounded-xl border ${c.card} overflow-hidden`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-zinc-100/40 dark:hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-zinc-900 dark:text-white capitalize">{name}</span>
              {isPrimary && (
                <span className="text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5">
                  orchestrator
                </span>
              )}
              <span className={`text-xs rounded border px-1.5 py-0.5 ${c.badge}`}>
                {config.mode}
              </span>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1 max-w-md">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-500">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
          </span>
          <ChevronDown size={14} className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-5 pb-5 pt-4 space-y-4">
              {/* Skills */}
              {skills.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Assigned Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="font-mono text-xs rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Permissions */}
              <div>
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Permissions</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(config.permission).map(([k, v]) => (
                    <PermissionBadge key={k} perm={v} label={k} />
                  ))}
                </div>
              </div>

              {/* Model */}
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-zinc-400 dark:text-zinc-500" />
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{(config as { model?: string }).model ?? "—"}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AgentsGrid({ agents }: Props) {
  const agentEntries = Object.entries(agents);
  const [primary, ...rest] = agentEntries.filter(([k]) => k === "primary")
    .concat(agentEntries.filter(([k]) => k !== "primary"));

  const ordered = primary ? [primary, ...rest] : rest;
  const totalSkills = ordered.reduce((sum, [, cfg]) => {
    const s = cfg.skills ?? (cfg.skill ? [cfg.skill] : []);
    return sum + s.length;
  }, 0);

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-10 grid grid-cols-3 gap-4 text-center">
        {[
          { value: ordered.length, label: "Agents" },
          { value: ordered.filter(([, c]) => c.mode === "subagent").length, label: "Subagents" },
          { value: totalSkills, label: "Total skill bindings" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 py-5 px-3">
            <div className="text-3xl font-black font-mono text-zinc-900 dark:text-white mb-1">{s.value}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      <motion.div
        className="space-y-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {ordered.map(([name, config]) => {
          const skills = config.skills ?? (config.skill ? [config.skill] : []);
          return (
            <motion.div
              key={name}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            >
              <AgentCard
                name={name}
                config={config}
                skills={skills}
                isPrimary={name === "primary"}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

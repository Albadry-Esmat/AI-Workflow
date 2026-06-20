"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { SkillEntry } from "@/lib/data";
import { DOMAIN_COLORS, MASTERY_COLORS } from "@/lib/colors";

interface Props { skills: SkillEntry[] }

export function ReferenceClient({ skills }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {skills.map((skill) => {
        const d = skill.domain ?? "meta";
        const c = DOMAIN_COLORS[d] ?? DOMAIN_COLORS["meta"];
        const mc = MASTERY_COLORS[skill.mastery_level] ?? "";
        const isOpen = open === skill.id;
        const inputs = skill.registry?.inputs ?? [];
        const outputs = skill.registry?.outputs ?? [];
        const feedbackRoutes = skill.registry?.feedback_routes ?? [];

        return (
          <div
            key={skill.id}
            id={skill.id}
            className={`rounded-xl border transition-colors ${isOpen ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900" : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
          >
            {/* Header row */}
            <button
              className="w-full flex items-center gap-4 px-5 py-4 text-left"
              onClick={() => setOpen(isOpen ? null : skill.id)}
              aria-expanded={isOpen}
              aria-controls={`${skill.id}-panel`}
            >
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600 w-16 shrink-0">{skill.id}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-zinc-900 dark:text-white">{skill.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 truncate mt-0.5">{skill.short_description}</div>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <span className={`text-xs rounded-full border px-2.5 py-0.5 ${c.border} ${c.bg} ${c.text}`}>{d}</span>
                <span className={`text-xs rounded-md border px-2 py-0.5 ${mc}`}>{skill.mastery_level}</span>
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">v{skill.version}</span>
              </div>
              <ChevronDown
                size={16}
                className={`text-zinc-400 dark:text-zinc-500 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Expanded detail */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  id={`${skill.id}-panel`}
                  role="region"
                  aria-label={`${skill.name} details`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-6 border-t border-zinc-200 dark:border-zinc-800 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">When to use</h4>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{skill.use_when}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">When NOT to use</h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{skill.do_not_use_when}</p>
                      </div>
                      {skill.registry?.orchestration && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Orchestration</h4>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{skill.registry.orchestration}</p>
                        </div>
                      )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">
                      {inputs.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Inputs</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {inputs.map((inp) => (
                              <span key={inp} className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-cyan-600 dark:text-cyan-300 rounded px-2 py-0.5">{inp}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {outputs.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Outputs</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {outputs.map((out) => (
                              <span key={out} className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-violet-600 dark:text-violet-300 rounded px-2 py-0.5">{out}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {skill.depends_on.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Depends On</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {skill.depends_on.map((dep) => (
                              <button
                                key={dep}
                                onClick={() => { setOpen(dep); document.getElementById(dep)?.scrollIntoView({ behavior: "smooth" }); }}
                                className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-amber-600 dark:text-amber-300 rounded px-2 py-0.5 hover:border-amber-500/50 transition-colors"
                              >
                                {dep}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {feedbackRoutes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Feedback Routes</h4>
                          <div className="space-y-2">
                            {feedbackRoutes.map((fr) => (
                              <div key={fr.condition} className="rounded-lg bg-zinc-100/60 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 p-2.5">
                                <div className="text-xs font-mono text-pink-400 mb-1">{fr.condition}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">→ {fr.target_skill}: {fr.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                          <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {skill.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 rounded px-2 py-0.5 border border-zinc-200 dark:border-zinc-700">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

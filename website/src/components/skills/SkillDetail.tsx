"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SkillEntry, FeedbackRoute } from "@/lib/data";
import { DOMAIN_COLORS, MASTERY_COLORS } from "@/lib/colors";

interface Props {
  skill: SkillEntry;
}

import type { Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function SidebarCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-5"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

export function SkillDetail({ skill }: Props) {
  const domain = skill.domain ?? "meta";
  const dc = DOMAIN_COLORS[domain] ?? DOMAIN_COLORS["meta"];
  const mc = MASTERY_COLORS[skill.mastery_level] ?? "";

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <Link
          href="/skills"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Skills
        </Link>
      </motion.div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-12"
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            className={`text-xs rounded-full border px-2.5 py-0.5 ${dc.border} ${dc.bg} ${dc.text}`}
          >
            {domain}
          </span>
          <span className={`text-xs rounded-md border px-2 py-0.5 ${mc}`}>
            {skill.mastery_level}
          </span>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-0.5">
            v{skill.version}
          </span>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-700">{skill.id}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-3">
          {skill.name}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl text-lg leading-relaxed">
          {skill.short_description}
        </p>

        {skill.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">
        {/* Left: Spec content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-4">
            Skill Specification
          </h2>
          {skill.spec?.content ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 overflow-auto">
              <pre className="p-6 text-sm text-zinc-700 dark:text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                {skill.spec.content}
              </pre>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 p-12 text-center text-zinc-400 dark:text-zinc-600 text-sm">
              Spec not available
            </div>
          )}
        </motion.div>

        {/* Right: Sidebar */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4"
        >
          {/* When to Use */}
          <SidebarCard title="When to Use">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{skill.use_when}</p>
          </SidebarCard>

          {/* When NOT to Use */}
          <SidebarCard title="When NOT to Use">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {skill.do_not_use_when}
            </p>
          </SidebarCard>

          {/* Inputs / Outputs */}
          {skill.registry && (
            <SidebarCard title="Inputs / Outputs">
              {skill.registry.inputs && skill.registry.inputs.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                    Inputs
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {skill.registry.inputs.map((inp) => (
                      <span
                        key={inp}
                        className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-2 py-0.5 font-mono"
                      >
                        {inp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skill.registry.outputs && skill.registry.outputs.length > 0 && (
                <div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                    Outputs
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {skill.registry.outputs.map((out) => (
                      <span
                        key={out}
                        className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-2 py-0.5 font-mono"
                      >
                        {out}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SidebarCard>
          )}

          {/* Dependencies */}
          {(skill.depends_on.length > 0 ||
            (skill.related_skills && skill.related_skills.length > 0)) && (
            <SidebarCard title="Dependencies">
              {skill.depends_on.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                    Depends On
                  </span>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {skill.depends_on.map((dep) => (
                      <Link
                        key={dep}
                        href={`/skills/${dep}`}
                        className="text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-cyan-400 dark:hover:text-cyan-400 transition-colors"
                      >
                        → {dep}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {skill.related_skills && skill.related_skills.length > 0 && (
                <div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                    Related Skills
                  </span>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {skill.related_skills.map((rel) => (
                      <Link
                        key={rel}
                        href={`/skills/${rel}`}
                        className="text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-cyan-400 dark:hover:text-cyan-400 transition-colors"
                      >
                        ↗ {rel}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </SidebarCard>
          )}

          {/* Feedback Routes */}
          {skill.registry?.feedback_routes &&
            skill.registry.feedback_routes.length > 0 && (
              <SidebarCard title="Feedback Routes">
                <div className="flex flex-col gap-2">
                  {skill.registry.feedback_routes.map(
                    (route: FeedbackRoute, i: number) => (
                      <div
                        key={i}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/50 p-3"
                      >
                        <div className="font-mono text-xs text-cyan-400 mb-1">
                          {route.target_skill}
                        </div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                          {route.condition}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </SidebarCard>
            )}
        </motion.div>
      </div>
    </div>
  );
}

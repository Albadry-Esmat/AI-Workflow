"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { SkillEntry } from "@/lib/data";
import { DOMAIN_COLORS, MASTERY_COLORS } from "@/lib/colors";

interface Props { skills: SkillEntry[] }

const ALL = "all";

export function SkillsClient({ skills }: Props) {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState(ALL);
  const [mastery, setMastery] = useState(ALL);

  const domains = useMemo(() => {
    const set = new Set(skills.map((s) => s.domain ?? "meta"));
    return [ALL, ...Array.from(set).sort()];
  }, [skills]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return skills.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.short_description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        (s.use_when ?? "").toLowerCase().includes(q) ||
        (s.do_not_use_when ?? "").toLowerCase().includes(q) ||
        (s.registry?.orchestration ?? "").toLowerCase().includes(q) ||
        (s.registry?.inputs ?? []).some((i) => i.toLowerCase().includes(q)) ||
        (s.registry?.outputs ?? []).some((o) => o.toLowerCase().includes(q));
      const matchDomain = domain === ALL || (s.domain ?? "meta") === domain;
      const matchMastery = mastery === ALL || s.mastery_level === mastery;
      return matchSearch && matchDomain && matchMastery;
    });
  }, [skills, search, domain, mastery]);

  const clearFilters = () => { setSearch(""); setDomain(ALL); setMastery(ALL); };
  const hasFilters = search || domain !== ALL || mastery !== ALL;

  return (
    <div>
      {/* Filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search name, description, tags, inputs, outputs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search skills"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-9 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          aria-label="Filter by domain"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
        >
          {domains.map((d) => (
            <option key={d} value={d}>{d === ALL ? "All Domains" : d}</option>
          ))}
        </select>
        <select
          value={mastery}
          onChange={(e) => setMastery(e.target.value)}
          aria-label="Filter by mastery level"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
        >
          <option value={ALL}>All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {/* Count + clear */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          {filtered.length} of {skills.length} skills
        </p>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <X size={11} />
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((skill) => {
            const d = skill.domain ?? "meta";
            const c = DOMAIN_COLORS[d] ?? DOMAIN_COLORS["meta"];
            const mc = MASTERY_COLORS[skill.mastery_level] ?? "";
            return (
              <motion.div
                key={skill.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.18 }}
              >
                <Link
                  href={`/skills/${skill.id}`}
                  className="group block h-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-5 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">{skill.id}</span>
                      <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-zinc-100 mt-0.5">
                        {skill.name}
                      </h3>
                    </div>
                    <span className={`text-xs rounded-md border px-2 py-0.5 ml-2 shrink-0 ${mc}`}>
                      {skill.mastery_level}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 line-clamp-2">
                    {skill.short_description}
                  </p>

                  {/* use_when snippet */}
                  {skill.use_when && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-600 leading-relaxed mb-3 line-clamp-1 italic">
                      Use when: {skill.use_when}
                    </p>
                  )}

                  {/* Domain + version */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs rounded-full border px-2.5 py-0.5 ${c.border} ${c.bg} ${c.text}`}>
                      {d}
                    </span>
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">v{skill.version}</span>
                  </div>

                  {/* Tags */}
                  {skill.tags.slice(0, 3).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {skill.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 rounded px-1.5 py-0.5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-zinc-400 dark:text-zinc-500 mb-3">No skills match your filters.</p>
          <button onClick={clearFilters} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

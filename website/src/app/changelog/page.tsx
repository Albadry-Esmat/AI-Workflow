import { loadChangelog, loadSiteStats } from "@/lib/data";
import { ChangelogContent } from "@/components/changelog/ChangelogContent";

export const metadata = {
  title: "Changelog — ASE-OS",
  description:
    "Complete version history of ASE-OS — every skill addition, architecture change, and bug fix from v1.0.0 to present.",
  openGraph: {
    title: "Changelog — ASE-OS",
    description: "Complete version history of the ASE-OS skill system.",
    type: "website" as const,
  },
};

export default function ChangelogPage() {
  const sections = loadChangelog();
  const stats = loadSiteStats();
  const latest = sections[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          Latest: v{latest?.version} — {latest?.date}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Changelog</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Every notable change to ASE-OS, from the initial 5-skill release to v{stats.registryVersion} with {stats.totalSkills} skills.
          Follows the{" "}
          <a
            href="https://keepachangelog.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
          >
            Keep a Changelog
          </a>{" "}
          format.
        </p>
      </div>

      <ChangelogContent sections={sections} />
    </div>
  );
}

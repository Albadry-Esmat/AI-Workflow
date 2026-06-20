import { loadAllSkills } from "@/lib/data";
import { SkillsClient } from "@/components/skills/SkillsClient";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const skills = loadAllSkills();
  return {
    title: "Skills Directory",
    description: `All ${skills.length} skills in the ASE-OS registry — filterable by domain, mastery level, and dependencies.`,
    openGraph: {
      title: "Skills Directory — ASE-OS",
      description: `Browse all ${skills.length} ASE-OS skills: filterable by domain, mastery level, version, and dependency.`,
      type: "website",
    },
  };
}

export default function SkillsPage() {
  const skills = loadAllSkills();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-400">
          {skills.length} Skills Active
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Skills Directory</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Every capability in ASE-OS is a skill — versioned, schema-validated, and composable.
          Filter by domain, mastery level, or search by name and description.
        </p>
      </div>
      <SkillsClient skills={skills} />
    </div>
  );
}

import { loadAllSkills } from "@/lib/data";
import { SkillsClient } from "@/components/skills/SkillsClient";

export const metadata = {
  title: "Skills Directory — ASE-OS",
  description: "All 30 skills in the ASE-OS registry — filterable by domain, mastery level, and dependencies.",
};

export default function SkillsPage() {
  const skills = loadAllSkills();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-400">
          {skills.length} Skills Active
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Skills Directory</h1>
        <p className="text-zinc-400 max-w-xl mx-auto">
          Every capability in ASE-OS is a skill — versioned, schema-validated, and composable.
          Filter by domain, mastery level, or search by name.
        </p>
      </div>
      <SkillsClient skills={skills} />
    </div>
  );
}

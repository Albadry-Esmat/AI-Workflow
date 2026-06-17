import { loadAllSkills } from "@/lib/data";
import { ReferenceClient } from "@/components/reference/ReferenceClient";

export const metadata = {
  title: "Full Skills Reference — ASE-OS",
  description: "Complete specification for all 30 ASE-OS skills — inputs, outputs, orchestration rules, and usage guidelines.",
};

export default function ReferencePage() {
  const skills = loadAllSkills();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Full Skills Reference</h1>
        <p className="text-zinc-400 max-w-xl mx-auto">
          Complete specification for all {skills.length} skills — inputs, outputs, orchestration rules, dependencies, and usage guidelines.
        </p>
      </div>
      <ReferenceClient skills={skills} />
    </div>
  );
}

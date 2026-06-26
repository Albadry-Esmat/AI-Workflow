import { loadAllSkills } from "@/lib/data";
import { ReferenceClient } from "@/components/reference/ReferenceClient";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const skills = (() => { try { return loadAllSkills(); } catch { return []; } })();
  return {
    title: "Full Skills Reference",
    description: `Complete specification for all ${skills.length} ASE-OS skills — inputs, outputs, orchestration rules, and usage guidelines.`,
    openGraph: {
      title: "Full Skills Reference — ASE-OS",
      description: `Complete specification for all ${skills.length} ASE-OS skills — inputs, outputs, orchestration rules, and usage guidelines.`,
      type: "website",
    },
  };
}

export default function ReferencePage() {
  const skills = (() => { try { return loadAllSkills(); } catch { return []; } })();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Full Skills Reference</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Complete specification for all {skills.length} skills — inputs, outputs, orchestration rules, dependencies, and usage guidelines.
        </p>
      </div>
      <ReferenceClient skills={skills} />
    </div>
  );
}

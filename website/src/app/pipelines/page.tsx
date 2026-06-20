import type { Metadata } from "next";
import { loadAllPipelines } from "@/lib/data";
import { PipelinesClient } from "@/components/pipelines/PipelinesClient";

export async function generateMetadata(): Promise<Metadata> {
  const pipelines = loadAllPipelines();
  return {
    title: "Pipeline Templates",
    description: `All ${pipelines.length} ASE-OS pipeline templates — full pipeline, consumer website, developer portal, admin panel, pre-deploy, quick review, and more.`,
    openGraph: {
      title: "Pipeline Templates — ASE-OS",
      description: `Browse and compare all ${pipelines.length} ASE-OS pipeline templates side by side.`,
      type: "website",
    },
  };
}

export default function PipelinesPage() {
  const pipelines = loadAllPipelines();
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400">
          {pipelines.length} Templates Available
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">Pipeline Templates</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Every use case has a dedicated template — each one is a JSON configuration that wires
          skills into phases and gates. Click any template to expand all phases and gates.
        </p>
      </div>
      <PipelinesClient pipelines={pipelines} />
    </div>
  );
}

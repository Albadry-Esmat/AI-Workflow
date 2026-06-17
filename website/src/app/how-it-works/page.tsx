import { loadPipeline } from "@/lib/data";
import { PipelineFlow } from "@/components/pipeline/PipelineFlow";
import { EventFlowDiagram } from "@/components/pipeline/EventFlowDiagram";
import { LifecycleSteps } from "@/components/pipeline/LifecycleSteps";

export const metadata = {
  title: "How It Works — ASE-OS",
  description: "The full ASE-OS pipeline: from requirements to deployment, explained step by step with diagrams.",
};

export default function HowItWorksPage() {
  const pipeline = loadPipeline();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      {/* Header */}
      <div className="mb-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400">
          Pipeline v{pipeline.version}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          How ASE-OS Works
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto text-lg leading-relaxed">
          Every request follows a strict, non-skippable lifecycle. {pipeline.phases.length} phases,
          fully automated, with human approval gates at critical decision points.
        </p>
      </div>

      {/* Pipeline flow diagram — live from full-pipeline.json */}
      <PipelineFlow pipeline={pipeline} />

      {/* Lifecycle steps detail */}
      <LifecycleSteps pipeline={pipeline} />

      {/* Event flow */}
      <EventFlowDiagram />
    </div>
  );
}

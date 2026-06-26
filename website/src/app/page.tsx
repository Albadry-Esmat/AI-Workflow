import { loadSiteStats, loadChangelog } from "@/lib/data";
import { HeroSection } from "@/components/home/HeroSection";
import { PrinciplesSection } from "@/components/home/PrinciplesSection";
import { StatsSection } from "@/components/home/StatsSection";
import { WhatsNewBanner } from "@/components/home/WhatsNewBanner";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { CtaSection } from "@/components/home/CtaSection";

export default function HomePage() {
  const stats = (() => {
    try { return loadSiteStats(); }
    catch { return { totalSkills: 0, totalNodes: 0, totalEdges: 0, totalPipelinePhases: 0, totalPipelines: 0, totalAgents: 0, domainCounts: {} as Record<string, number>, registryVersion: "0.0.0" }; }
  })();
  const changelog = (() => { try { return loadChangelog(); } catch { return []; } })();

  // count domains
  const domains = Object.entries(stats.domainCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <HeroSection stats={stats} />
      <PrinciplesSection />
      <StatsSection stats={stats} domains={domains} />
      <WhatsNewBanner latestRelease={changelog[0] ?? undefined} stats={stats} />
      <FeaturesSection />
      <CtaSection stats={stats} />
    </>
  );
}

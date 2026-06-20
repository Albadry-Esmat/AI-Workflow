import { loadSiteStats, loadChangelog } from "@/lib/data";
import { HeroSection } from "@/components/home/HeroSection";
import { PrinciplesSection } from "@/components/home/PrinciplesSection";
import { StatsSection } from "@/components/home/StatsSection";
import { WhatsNewBanner } from "@/components/home/WhatsNewBanner";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { CtaSection } from "@/components/home/CtaSection";

export default function HomePage() {
  const stats = loadSiteStats();
  const changelog = loadChangelog();

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

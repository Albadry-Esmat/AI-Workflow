import { loadSiteStats, loadAllSkills } from "@/lib/data";
import { DOMAIN_COLORS } from "@/lib/colors";
import { HeroSection } from "@/components/home/HeroSection";
import { PrinciplesSection } from "@/components/home/PrinciplesSection";
import { StatsSection } from "@/components/home/StatsSection";
import { WhatsNewBanner } from "@/components/home/WhatsNewBanner";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { CtaSection } from "@/components/home/CtaSection";

export default function HomePage() {
  const stats = loadSiteStats();
  const skills = loadAllSkills();

  // count domains
  const domains = Object.entries(stats.domainCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <HeroSection stats={stats} />
      <PrinciplesSection />
      <StatsSection stats={stats} domains={domains} />
      <WhatsNewBanner />
      <FeaturesSection />
      <CtaSection stats={stats} />
    </>
  );
}

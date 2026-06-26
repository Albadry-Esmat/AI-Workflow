import type { MetadataRoute } from "next";
import { loadSkillIndex } from "@/lib/data";
import { SITE_URL } from "@/lib/site.config";

export default function sitemap(): MetadataRoute.Sitemap {
  let skills: { id: string }[] = [];
  try {
    skills = loadSkillIndex();
  } catch {
    // data unavailable — omit skill routes from sitemap
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL,                        lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/how-it-works`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${SITE_URL}/skills`,            lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/pipelines`,         lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/architecture`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/agents`,            lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${SITE_URL}/reference`,         lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${SITE_URL}/changelog`,         lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${SITE_URL}/getting-started`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`,             lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  const skillRoutes: MetadataRoute.Sitemap = skills.map((skill) => ({
    url: `${SITE_URL}/skills/${skill.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...skillRoutes];
}

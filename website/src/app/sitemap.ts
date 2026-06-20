import type { MetadataRoute } from "next";
import { loadSkillIndex } from "@/lib/data";

const BASE_URL = "https://ase-os.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const skills = loadSkillIndex();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                      lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0  },
    { url: `${BASE_URL}/how-it-works`,    lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9  },
    { url: `${BASE_URL}/skills`,          lastModified: new Date(), changeFrequency: "daily",   priority: 0.9  },
    { url: `${BASE_URL}/pipelines`,       lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8  },
    { url: `${BASE_URL}/architecture`,    lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8  },
    { url: `${BASE_URL}/agents`,          lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7  },
    { url: `${BASE_URL}/reference`,       lastModified: new Date(), changeFrequency: "daily",   priority: 0.8  },
    { url: `${BASE_URL}/changelog`,       lastModified: new Date(), changeFrequency: "daily",   priority: 0.7  },
    { url: `${BASE_URL}/getting-started`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7  },
    { url: `${BASE_URL}/about`,           lastModified: new Date(), changeFrequency: "monthly", priority: 0.6  },
  ];

  const skillRoutes: MetadataRoute.Sitemap = skills.map((skill) => ({
    url: `${BASE_URL}/skills/${skill.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...skillRoutes];
}

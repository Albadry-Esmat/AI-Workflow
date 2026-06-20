import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { loadSiteStats } from "@/lib/data";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ASE-OS — AI Software Engineering Operating System",
    template: "%s — ASE-OS",
  },
  description:
    "A unified, skill-driven, event-driven AI engineering system that designs, generates, tests, and documents software autonomously.",
  metadataBase: new URL("https://ase-os.vercel.app"),
    openGraph: {
      title: "ASE-OS — AI Software Engineering Operating System",
      description:
        "A unified, skill-driven AI system that takes your idea from requirements to deployed software — automatically, with zero documentation drift.",
      type: "website",
      url: "https://ase-os.vercel.app",
      siteName: "ASE-OS",
    },
    twitter: {
      card: "summary_large_image",
      title: "ASE-OS — AI Software Engineering Operating System",
      description:
        "Skill-driven AI engineering. Full requirements traceability. Ideas to deployed software, automatically.",
    },
};

const FALLBACK_STATS = {
  totalSkills: 0,
  totalEdges: 0,
  totalPipelinePhases: 0,
  totalAgents: 0,
  domainCounts: {} as Record<string, number>,
  registryVersion: "0.0.0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let stats = FALLBACK_STATS;
  try {
    stats = loadSiteStats();
  } catch {
    // File not found or parse error — use fallback so the layout still renders
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}>
        <Providers>
          <Navbar version={stats.registryVersion} />
          <main>{children}</main>
          <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-24 py-10">
            <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-500">
              <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                <span>ASE-OS — AI Software Engineering Operating System</span>
                <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">·</span>
                <span>
                  Built by{" "}
                  <Link
                    href="/about"
                    className="font-semibold text-zinc-700 dark:text-zinc-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    Albadry Esmat
                  </Link>
                </span>
              </div>
              <span className="font-mono text-xs">
                Skill System v{stats.registryVersion} · {stats.totalSkills} Skills · {stats.totalEdges} Edges
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { loadSiteStats } from "@/lib/data";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ASE-OS — AI Software Engineering Operating System",
  description:
    "A unified, skill-driven, event-driven AI engineering system that designs, generates, tests, and documents software autonomously.",
  metadataBase: new URL("https://ase-os.vercel.app"),
  openGraph: {
    title: "ASE-OS — AI Software Engineering Operating System",
    description:
      "A unified, skill-driven AI system that takes your idea from requirements to deployed software — automatically, with 40 skills and zero documentation drift.",
    type: "website",
    url: "https://ase-os.vercel.app",
    siteName: "ASE-OS",
  },
  twitter: {
    card: "summary_large_image",
    title: "ASE-OS — AI Software Engineering Operating System",
    description:
      "40 skills. 14 pipeline phases. Full requirements traceability. Ideas to deployed software, automatically.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const stats = loadSiteStats();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}>
        <Providers>
          <Navbar version={stats.registryVersion} />
          <main>{children}</main>
          <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-24 py-10">
            <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-500">
              <span>ASE-OS — AI Software Engineering Operating System</span>
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

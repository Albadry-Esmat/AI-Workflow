import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ASE-OS — AI Software Engineering Operating System",
  description:
    "A unified, skill-driven, event-driven AI engineering system that designs, generates, tests, and documents software autonomously.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}>
        <Providers>
          <Navbar />
          <main>{children}</main>
          <footer className="border-t border-zinc-800 mt-24 py-10">
            <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
              <span>ASE-OS — AI Software Engineering Operating System</span>
              <span className="font-mono text-xs">Skill System v1.5.0 · 30 Skills · 67 Edges</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

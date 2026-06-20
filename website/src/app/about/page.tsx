import type { Metadata } from "next";
import { AboutContent } from "./AboutContent";

export const metadata: Metadata = {
  title: "About",
  description:
    "Albadry Esmat — creator of ASE-OS. Building AI systems that do real engineering work.",
  openGraph: {
    title: "About — ASE-OS",
    description: "Albadry Esmat — creator of ASE-OS. Building AI systems that do real engineering work.",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutContent />;
}

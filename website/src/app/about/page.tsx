import type { Metadata } from "next";
import { CREATOR_NAME, CREATOR_TITLE } from "@/lib/site.config";
import { AboutContent } from "./AboutContent";

export const metadata: Metadata = {
  title: "About",
  description:
    `${CREATOR_NAME} — ${CREATOR_TITLE}. Building AI systems that do real engineering work.`,
  openGraph: {
    title: `About — AI Workflow`,
    description: `${CREATOR_NAME} — ${CREATOR_TITLE}.`,
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutContent />;
}

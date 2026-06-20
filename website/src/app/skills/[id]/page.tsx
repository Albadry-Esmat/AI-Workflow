import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { loadSkillIndex, loadSkillDetail } from "@/lib/data";
import { SkillDetail } from "@/components/skills/SkillDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  // loadSkillIndex is lighter than loadAllSkills — we only need the IDs here
  const skills = loadSkillIndex();
  return skills.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const skill = loadSkillDetail(id);
  if (!skill) {
    return { title: "Skill Not Found" };
  }
  return {
    title: skill.name,
    description: skill.short_description,
    openGraph: {
      title: `${skill.name} — ASE-OS Skills`,
      description: skill.short_description,
      type: "website",
    },
  };
}

export default async function SkillDetailPage({ params }: Props) {
  const { id } = await params;
  const skill = loadSkillDetail(id);
  if (!skill) notFound();
  // Render markdown → HTML on the server, then sanitize to prevent XSS
  const specHtml = skill.spec?.content
    ? DOMPurify.sanitize(marked.parse(skill.spec.content) as string)
    : undefined;
  return <SkillDetail skill={skill} specHtml={specHtml} />;
}

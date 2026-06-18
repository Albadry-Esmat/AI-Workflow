import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadSkillDetail, loadAllSkills } from "@/lib/data";
import { SkillDetail } from "@/components/skills/SkillDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const skills = loadAllSkills();
  return skills.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const skill = loadSkillDetail(id);
  if (!skill) {
    return { title: "Skill Not Found — ASE-OS" };
  }
  return {
    title: `${skill.name} — ASE-OS Skills`,
    description: skill.short_description,
  };
}

export default async function SkillDetailPage({ params }: Props) {
  const { id } = await params;
  const skill = loadSkillDetail(id);
  if (!skill) notFound();
  return <SkillDetail skill={skill} />;
}

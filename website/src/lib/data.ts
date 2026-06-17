/**
 * Data layer — reads live project files at build time.
 * All content on the website is derived from these sources.
 * When project files change, the next `npm run build` picks up all changes automatically.
 *
 * Sources:
 *   skills/index.yaml               - skill metadata, descriptions, dependencies
 *   skills/registry.json            - skill I/O, orchestration rules, feedback_routes
 *   skills/graph/skill-graph.yaml   - DAG nodes and edges
 *   skills/pipelines/full-pipeline.json - pipeline phases and gates
 *   .opencode/skills/*\/SKILL.md    - individual skill specs (frontmatter + body)
 *   opencode.json                   - agent configuration
 */

import path from "path";
import fs from "fs";
import matter from "gray-matter";
import yaml from "js-yaml";

// ─── Root path resolution ────────────────────────────────────────────────────
// website/ is a subdirectory of the project root
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

export function projectPath(...segments: string[]) {
  return path.join(PROJECT_ROOT, ...segments);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SkillEntry {
  id: string;
  name: string;
  short_description: string;
  reference_path: string;
  executable_skill: string;
  tags: string[];
  version: string;
  depends_on: string[];
  related_skills?: string[];
  mastery_level: "beginner" | "intermediate" | "advanced";
  use_when: string;
  do_not_use_when: string;
  domain?: string;
  // enriched from registry.json
  registry?: RegistryEntry;
  // enriched from SKILL.md
  spec?: SkillSpec;
}

export interface RegistryEntry {
  name: string;
  version: string;
  status: "active" | "deprecated" | "retired";
  domain: string;
  path: string;
  description: string;
  inputs: string[];
  outputs: string[];
  consumes_from: string[] | null;
  produces_for: string[] | null;
  orchestration: string;
  feedback_routes: FeedbackRoute[];
}

export interface FeedbackRoute {
  target_skill: string;
  condition: string;
  description: string;
}

export interface SkillSpec {
  frontmatter: {
    name: string;
    version: string;
    domain: string;
    description: string;
    author: string;
  };
  content: string;
}

export interface GraphNode {
  id: string;
  name: string;
  domain: string;
  mastery_level: string;
  version: string;
  status: string;
  layer: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "dependency" | "composition" | "extension" | "co_occurrence";
  label: string;
}

export interface SkillGraph {
  meta: { version: string; total_nodes: number; total_edges: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PipelinePhase {
  id: string;
  label: string;
  skills: { name: string; version: string; max_retries: number; async?: boolean }[];
  parallel?: boolean;
  async?: boolean;
  condition?: string;
}

export interface PipelineGate {
  after_phase?: string;
  after_skill?: string;
  type: "human_approval" | "auto";
  label: string;
  timeout?: number;
  condition?: string;
}

export interface Pipeline {
  name: string;
  version: string;
  description: string;
  phases: PipelinePhase[];
  gates: PipelineGate[];
  recovery: { on_critical_failure: string; max_repair_iterations: number };
}

export interface AgentConfig {
  [key: string]: {
    mode: string;
    description: string;
    skill?: string;
    skills?: string[];
    permission: Record<string, string>;
  };
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

export function loadSkillIndex(): SkillEntry[] {
  const filePath = projectPath("skills", "index.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(raw) as { skills: SkillEntry[] };
  return parsed.skills;
}

export function loadRegistry(): RegistryEntry[] {
  const filePath = projectPath("skills", "registry.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.skills as RegistryEntry[];
}

export function loadSkillGraph(): SkillGraph {
  const filePath = projectPath("skills", "graph", "skill-graph.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw) as SkillGraph;
}

export function loadPipeline(): Pipeline {
  const filePath = projectPath("skills", "pipelines", "full-pipeline.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as Pipeline;
}

export function loadAgentConfig(): AgentConfig {
  const filePath = projectPath("opencode.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.agent as AgentConfig;
}

export function loadSkillSpec(skillName: string): SkillSpec | null {
  const filePath = projectPath(".opencode", "skills", skillName, "SKILL.md");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  return {
    frontmatter: data as SkillSpec["frontmatter"],
    content,
  };
}

// ─── Enriched data builders ──────────────────────────────────────────────────

export function loadAllSkills(): SkillEntry[] {
  const index = loadSkillIndex();
  const registry = loadRegistry();

  const registryMap = new Map(registry.map((r) => [r.name, r]));

  return index.map((skill) => {
    // derive skill name from executable_skill path
    const match = skill.executable_skill.match(/skills\/([^/]+)\/SKILL\.md/);
    const skillName = match ? match[1] : "";
    const registryEntry = registryMap.get(skillName);

    return {
      ...skill,
      domain: registryEntry?.domain,
      registry: registryEntry,
    };
  });
}

export function loadSkillDetail(skillId: string): SkillEntry | null {
  const all = loadAllSkills();
  const skill = all.find((s) => s.id === skillId);
  if (!skill) return null;

  const match = skill.executable_skill.match(/skills\/([^/]+)\/SKILL\.md/);
  const skillName = match ? match[1] : "";
  const spec = loadSkillSpec(skillName);

  return { ...skill, spec: spec ?? undefined };
}

// ─── Stats (auto-derived from live files) ────────────────────────────────────

export function loadSiteStats() {
  const skills = loadSkillIndex();
  const graph = loadSkillGraph();
  const pipeline = loadPipeline();
  const agents = loadAgentConfig();

  const domainCounts: Record<string, number> = {};
  const registry = loadRegistry();
  registry.forEach((r) => {
    domainCounts[r.domain] = (domainCounts[r.domain] ?? 0) + 1;
  });

  return {
    totalSkills: skills.length,
    totalEdges: graph.meta.total_edges,
    totalPipelinePhases: pipeline.phases.length,
    totalAgents: Object.keys(agents).length,
    domainCounts,
    registryVersion: (() => {
      const filePath = projectPath("skills", "registry.json");
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw).version as string;
    })(),
  };
}

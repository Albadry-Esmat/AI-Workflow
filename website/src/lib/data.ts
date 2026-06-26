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
// Priority order:
//   1. DATA_ROOT env var (explicit override)
//   2. ./data/  inside the website directory (standalone / ase-os-website clone)
//   3. ../      parent directory (monorepo / AI-Workflow development mode)
const _localDataDir = path.resolve(process.cwd(), "data");
const PROJECT_ROOT = process.env.DATA_ROOT
  ? path.resolve(process.env.DATA_ROOT)
  : fs.existsSync(path.join(_localDataDir, "skills", "index.yaml"))
    ? _localDataDir
    : path.resolve(process.cwd(), "..");

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
    author?: string;
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
  type: "human_approval" | "auto" | "condition";
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
    model?: string;
    skill?: string;
    skills?: string[];
    permission: Record<string, string>;
  };
}

export interface PipelineTemplate {
  id: string;          // filename without .json
  name: string;
  version: string;
  description: string;
  phases: PipelinePhase[];
  gates: PipelineGate[];
  recovery?: { on_critical_failure: string; max_repair_iterations: number };
}

export interface ChangelogSection {
  version: string;     // e.g. "2.5.0"
  date: string;        // e.g. "2026-06-18"
  groups: { label: string; items: string[] }[];
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

export function loadSkillIndex(): SkillEntry[] {
  const filePath = projectPath("skills", "index.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(raw) as { skills: SkillEntry[] } | null;
  return (parsed ?? { skills: [] }).skills;
}

/** Internal helper — parses registry.json once and returns both version and entries. */
function parseRegistry(): { version: string; skills: RegistryEntry[] } {
  const filePath = projectPath("skills", "registry.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as { version: string; skills: RegistryEntry[] };
}

export function loadRegistry(): RegistryEntry[] {
  return parseRegistry().skills;
}

export function loadSkillGraph(): SkillGraph {
  const filePath = projectPath("skills", "graph", "skill-graph.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  return (yaml.load(raw) as SkillGraph | null) ?? {
    meta: { version: "0.0.0", total_nodes: 0, total_edges: 0 },
    nodes: [],
    edges: [],
  };
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
  return (parsed.agent as AgentConfig | undefined) ?? {};
}

export function loadSkillSpec(skillName: string): SkillSpec | null {
  const filePath = projectPath(".opencode", "skills", skillName, "SKILL.md");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");

  let data: Record<string, string> = {};
  let content = raw;

  try {
    const parsed = matter(raw);
    data = parsed.data as Record<string, string>;
    content = parsed.content;
  } catch {
    // Frontmatter YAML parse failed (e.g. unquoted colons/double-quotes in description).
    // Strip the ---...--- block manually and surface just the markdown body.
    content = raw.replace(/^---[\s\S]*?---\s*\n/, "");
    // Best-effort: extract simple key: value pairs via regex
    const fmBlock = raw.match(/^---([\s\S]*?)---/)?.[1] ?? "";
    for (const line of fmBlock.split("\n")) {
      const m = line.match(/^(\w[\w-]*):\s+(.+)$/);
      if (m) data[m[1]] = m[2];
    }
  }

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

// ─── All pipeline templates ──────────────────────────────────────────────────
// Auto-discovered from skills/pipelines/ — no manual list needed.
// Any .json file added to that directory is picked up on the next build.

export function loadAllPipelines(): PipelineTemplate[] {
  const pipelinesDir = projectPath("skills", "pipelines");

  let files: string[] = [];
  try {
    files = fs
      .readdirSync(pipelinesDir)
      .filter((f) => f.endsWith(".json"))
      .sort(); // stable alphabetical order
  } catch {
    return []; // directory missing or unreadable
  }

  const results: PipelineTemplate[] = [];
  for (const filename of files) {
    const id = filename.replace(/\.json$/, "");
    const filePath = path.join(pipelinesDir, filename);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    } catch {
      continue; // skip malformed files
    }

    // Normalize flat-format pipelines (skills[]) to phases[] for uniform rendering
    let phases: PipelinePhase[] = (parsed.phases as PipelinePhase[]) ?? [];
    if (phases.length === 0 && Array.isArray(parsed.skills)) {
      phases = [{
        id: "main",
        label: parsed.name ? String(parsed.name).replace(/-/g, " ") : "Main",
        skills: parsed.skills as PipelinePhase["skills"],
      }];
    }

    results.push({
      id,
      name:        String(parsed.name ?? id),
      version:     String(parsed.version ?? "1.0.0"),
      description: String(parsed.description ?? ""),
      phases,
      gates:       (parsed.gates as PipelineGate[]) ?? [],
      recovery:    parsed.recovery as PipelineTemplate["recovery"],
    });
  }
  return results;
}

// ─── Changelog ───────────────────────────────────────────────────────────────

export function loadChangelog(): ChangelogSection[] {
  const filePath = projectPath("docs", "changelog.md");
  const raw = fs.readFileSync(filePath, "utf8");

  const sections: ChangelogSection[] = [];
  // Split on version headings: ## [X.Y.Z] — YYYY-MM-DD
  const parts = raw.split(/^(?=## \[\d)/m);

  for (const part of parts) {
    const header = part.match(/^## \[(\d+\.\d+\.\d+)\] — (\d{4}-\d{2}-\d{2})/);
    if (!header) continue;
    const version = header[1];
    const date = header[2];

    const groups: { label: string; items: string[] }[] = [];
    // Split on ### sub-headings
    const subparts = part.split(/^(?=### )/m);
    for (const sub of subparts) {
      const subHeader = sub.match(/^### (.+)/);
      if (!subHeader) continue;
      const label = subHeader[1].trim();
      const items = sub
        .replace(/^### .+\n/, "")
        .split("\n")
        .filter((l) => /^[\s]*[-*]\s/.test(l))
        .map((l) => l.replace(/^[\s*-]+/, "").trim())
        .filter(Boolean);
      if (items.length > 0) groups.push({ label, items });
    }
    sections.push({ version, date, groups });
  }
  return sections;
}

// ─── Stats (auto-derived from live files) ────────────────────────────────────
export function loadSiteStats() {
  const skills = loadSkillIndex();
  const graph = loadSkillGraph();
  const pipeline = loadPipeline();
  const agents = loadAgentConfig();
  const pipelines = loadAllPipelines();
  const { version: registryVersion, skills: registryEntries } = parseRegistry();

  const domainCounts: Record<string, number> = {};
  registryEntries.forEach((r) => {
    domainCounts[r.domain] = (domainCounts[r.domain] ?? 0) + 1;
  });

  return {
    totalSkills: skills.length,
    totalNodes: graph.meta.total_nodes,
    totalEdges: graph.meta.total_edges,
    totalPipelinePhases: pipeline.phases.length,
    totalPipelines: pipelines.length,
    totalAgents: Object.keys(agents).length,
    domainCounts,
    registryVersion,
  };
}

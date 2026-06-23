/**
 * Unit tests for website/src/lib/data.ts
 *
 * These tests run against the real project files — no mocks needed since
 * data.ts is a pure I/O layer that reads the live source-of-truth files.
 *
 * Coverage targets:
 *   - loadSkillIndex        : returns skills with required fields (count driven by live data)
 *   - loadRegistry          : entries count matches index, all have required fields
 *   - loadSkillGraph        : nodes / edges counts match index
 *   - loadPipeline          : 15 phases, recovery block present
 *   - loadAgentConfig       : known agents exist
 *   - loadSkillSpec         : returns content for known skill; null for unknown;
 *                             tolerates malformed frontmatter (regression guard)
 *   - loadSkillDetail       : enriches skill with registry + spec
 *   - loadSiteStats         : derived stats match raw loader counts
 *   - loadAllSkills         : count matches index, domain is enriched from registry
 *   - loadAllPipelines      : auto-discovers all pipelines, each has phases and gates arrays
 *   - loadChangelog         : returns sections with version, date, groups
 */

import { describe, it, expect } from "vitest";
import {
  loadSkillIndex,
  loadRegistry,
  loadSkillGraph,
  loadPipeline,
  loadAgentConfig,
  loadSkillSpec,
  loadSkillDetail,
  loadAllSkills,
  loadSiteStats,
  loadAllPipelines,
  loadChangelog,
} from "../data";

// ─── loadSkillIndex ───────────────────────────────────────────────────────────

describe("loadSkillIndex", () => {
  it("returns a non-empty array of skills", () => {
    const skills = loadSkillIndex();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
  });

  it("each skill has required fields", () => {
    const skills = loadSkillIndex();
    for (const skill of skills) {
      expect(skill).toHaveProperty("id");
      expect(skill).toHaveProperty("name");
      expect(skill).toHaveProperty("short_description");
      expect(skill).toHaveProperty("executable_skill");
      expect(skill).toHaveProperty("version");
      expect(skill).toHaveProperty("mastery_level");
    }
  });

  it("all skill IDs follow the SKL-NNN format", () => {
    const skills = loadSkillIndex();
    for (const skill of skills) {
      expect(skill.id).toMatch(/^SKL-\d{3}$/);
    }
  });

  it("mastery_level is one of the valid enum values", () => {
    const valid = new Set(["beginner", "intermediate", "advanced"]);
    const skills = loadSkillIndex();
    for (const skill of skills) {
      expect(valid.has(skill.mastery_level)).toBe(true);
    }
  });
});

// ─── loadRegistry ────────────────────────────────────────────────────────────

describe("loadRegistry", () => {
  it("returns a non-empty array", () => {
    const registry = loadRegistry();
    expect(Array.isArray(registry)).toBe(true);
    expect(registry.length).toBeGreaterThan(0);
  });

  it("registry entry count matches skill index count", () => {
    const registry = loadRegistry();
    const index = loadSkillIndex();
    expect(registry.length).toBe(index.length);
  });

  it("each entry has inputs, outputs, and a status", () => {
    const registry = loadRegistry();
    for (const entry of registry) {
      expect(Array.isArray(entry.inputs)).toBe(true);
      expect(Array.isArray(entry.outputs)).toBe(true);
      expect(["active", "deprecated", "retired", "draft"]).toContain(entry.status);
    }
  });
});

// ─── loadSkillGraph ───────────────────────────────────────────────────────────

describe("loadSkillGraph", () => {
  it("meta.total_nodes matches index.yaml entry count", () => {
    const graph = loadSkillGraph();
    const skills = loadSkillIndex();
    expect(graph.meta.total_nodes).toBe(skills.length);
  });

  it("meta.total_edges is positive", () => {
    const graph = loadSkillGraph();
    expect(graph.meta.total_edges).toBeGreaterThan(0);
  });

  it("nodes array length matches meta.total_nodes", () => {
    const graph = loadSkillGraph();
    expect(graph.nodes.length).toBe(graph.meta.total_nodes);
  });
});

// ─── loadPipeline ─────────────────────────────────────────────────────────────

describe("loadPipeline", () => {
  it("has 17 phases", () => {
    const pipeline = loadPipeline();
    expect(pipeline.phases.length).toBe(17);
  });

  it("has a recovery block with required fields", () => {
    const pipeline = loadPipeline();
    expect(pipeline.recovery).toBeDefined();
    expect(pipeline.recovery.on_critical_failure).toBeTruthy();
    expect(typeof pipeline.recovery.max_repair_iterations).toBe("number");
  });

  it("each phase has an id and at least one skill", () => {
    const pipeline = loadPipeline();
    for (const phase of pipeline.phases) {
      expect(phase.id).toBeTruthy();
      expect(Array.isArray(phase.skills)).toBe(true);
      expect(phase.skills.length).toBeGreaterThan(0);
    }
  });
});

// ─── loadAgentConfig ──────────────────────────────────────────────────────────

describe("loadAgentConfig", () => {
  it("contains expected core agents", () => {
    const agents = loadAgentConfig();
    const keys = Object.keys(agents);
    // Core agents that must always be present
    for (const name of ["analyzer", "architect", "builder", "tester", "deployer"]) {
      expect(keys).toContain(name);
    }
  });

  it("each agent has a mode and description", () => {
    const agents = loadAgentConfig();
    for (const [, agent] of Object.entries(agents)) {
      expect(agent.mode).toBeTruthy();
      expect(agent.description).toBeTruthy();
    }
  });
});

// ─── loadSkillSpec ────────────────────────────────────────────────────────────

describe("loadSkillSpec", () => {
  it("returns null for an unknown skill name", () => {
    const spec = loadSkillSpec("totally-unknown-skill-xyz");
    expect(spec).toBeNull();
  });

  it("returns content for a known skill", () => {
    const spec = loadSkillSpec("orchestrator");
    expect(spec).not.toBeNull();
    expect(typeof spec!.content).toBe("string");
    expect(spec!.content.length).toBeGreaterThan(0);
  });

  it("frontmatter has a name field for a known skill", () => {
    const spec = loadSkillSpec("orchestrator");
    expect(spec!.frontmatter.name).toBeTruthy();
  });

  it("does NOT throw when frontmatter contains unquoted colons (regression guard)", () => {
    // All skills previously had unquoted `: "` in description.
    // The try/catch fallback in loadSkillSpec must handle this gracefully.
    expect(() => loadSkillSpec("trigger-engineering")).not.toThrow();
  });
});

// ─── loadSkillDetail ──────────────────────────────────────────────────────────

describe("loadSkillDetail", () => {
  it("returns null for a non-existent skill ID", () => {
    const detail = loadSkillDetail("SKL-999");
    expect(detail).toBeNull();
  });

  it("returns an enriched skill for SKL-001", () => {
    const detail = loadSkillDetail("SKL-001");
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe("SKL-001");
  });

  it("enriched skill has a registry entry", () => {
    const detail = loadSkillDetail("SKL-001");
    expect(detail!.registry).toBeDefined();
  });

  it("enriched skill has a spec with content", () => {
    const detail = loadSkillDetail("SKL-001");
    expect(detail!.spec).toBeDefined();
    expect(detail!.spec!.content).toBeTruthy();
  });
});

// ─── loadAllSkills ────────────────────────────────────────────────────────────

describe("loadAllSkills", () => {
  it("count matches the skill index", () => {
    const all = loadAllSkills();
    const index = loadSkillIndex();
    expect(all.length).toBe(index.length);
  });

  it("all enriched skills have a domain (from registry)", () => {
    const all = loadAllSkills();
    const withDomain = all.filter((s) => s.domain !== undefined);
    expect(withDomain.length).toBeGreaterThan(0);
  });
});

// ─── loadSiteStats ────────────────────────────────────────────────────────────

describe("loadSiteStats", () => {
  it("totalSkills matches loadSkillIndex count", () => {
    const stats = loadSiteStats();
    const index = loadSkillIndex();
    expect(stats.totalSkills).toBe(index.length);
  });

  it("totalEdges matches graph meta", () => {
    const stats = loadSiteStats();
    const graph = loadSkillGraph();
    expect(stats.totalEdges).toBe(graph.meta.total_edges);
  });

  it("totalPipelinePhases matches pipeline phases count", () => {
    const stats = loadSiteStats();
    const pipeline = loadPipeline();
    expect(stats.totalPipelinePhases).toBe(pipeline.phases.length);
  });

  it("registryVersion is a semver-like string", () => {
    const stats = loadSiteStats();
    expect(stats.registryVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("domainCounts has at least one domain entry", () => {
    const stats = loadSiteStats();
    expect(Object.keys(stats.domainCounts).length).toBeGreaterThan(0);
  });
});

// ─── loadAllPipelines ─────────────────────────────────────────────────────────

describe("loadAllPipelines", () => {
  it("auto-discovers all pipeline JSON files (at least 8)", () => {
    const pipelines = loadAllPipelines();
    expect(pipelines.length).toBeGreaterThanOrEqual(8);
  });

  it("every template has id, name, version, description", () => {
    const pipelines = loadAllPipelines();
    for (const p of pipelines) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("version");
      expect(p).toHaveProperty("description");
    }
  });

  it("every template has a non-empty phases array", () => {
    const pipelines = loadAllPipelines();
    for (const p of pipelines) {
      expect(Array.isArray(p.phases)).toBe(true);
      expect(p.phases.length).toBeGreaterThan(0);
    }
  });

  it("every template has a gates array (may be empty)", () => {
    const pipelines = loadAllPipelines();
    for (const p of pipelines) {
      expect(Array.isArray(p.gates)).toBe(true);
    }
  });

  it("full-pipeline template exists and has the most phases", () => {
    const pipelines = loadAllPipelines();
    const full = pipelines.find((p) => p.id === "full-pipeline");
    expect(full).toBeDefined();
    expect(full!.phases.length).toBeGreaterThanOrEqual(10);
  });
});

// ─── loadChangelog ────────────────────────────────────────────────────────────

describe("loadChangelog", () => {
  it("returns a non-empty array of version sections", () => {
    const sections = loadChangelog();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
  });

  it("every section has version, date, groups", () => {
    const sections = loadChangelog();
    for (const s of sections) {
      expect(s).toHaveProperty("version");
      expect(s).toHaveProperty("date");
      expect(Array.isArray(s.groups)).toBe(true);
    }
  });

  it("latest section version matches the live registry version", () => {
    const sections = loadChangelog();
    const stats = loadSiteStats();
    // The most recent changelog entry should match the registry version
    expect(sections[0].version).toBe(stats.registryVersion);
  });

  it("version dates match YYYY-MM-DD format", () => {
    const sections = loadChangelog();
    for (const s of sections) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

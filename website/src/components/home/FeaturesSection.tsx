"use client";
import { motion } from "framer-motion";
import {
  GitBranch, ShieldCheck, FileCode2, TestTube2,
  BookOpen, RefreshCw, Zap, Lock,
  AlertTriangle, BarChart2, Route, Sparkles, Activity, Lightbulb,
  ClipboardList, Bot, Palette, Wand2,
  Scale, Diff, PlayCircle, GitFork, DollarSign, Layers2,
} from "lucide-react";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Architecture Enforcement",
    description: "Every code change is checked against the architecture before it runs. If code crosses a module boundary it shouldn't, the system blocks it — not just warns.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Zap,
    title: "Automatic Follow-Through",
    description: "Change a file and the system automatically kicks off code review, test checks, doc updates, and impact analysis. No manual steps, no forgetting.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Security That Can't Be Skipped",
    description: "When a change touches authentication, sessions, or data access, a security review runs automatically. There is no override path.",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    icon: FileCode2,
    title: "Code From Specs, Not Prompts",
    description: "All generated code comes from architecture specs. Every file is traceable to a module definition and carries a @req annotation — nothing is invented on the fly.",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
  {
    icon: TestTube2,
    title: "Tests That Stay Current",
    description: "Tests are generated from the code that was written. When code changes, new tests are generated to match — automatically.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    icon: BookOpen,
    title: "Docs That Never Fall Behind",
    description: "Documentation is generated from the live system state. Every code or architecture change triggers an automatic sync — docs are always current.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: RefreshCw,
    title: "One-Step Rollback",
    description: "The system takes a snapshot before every change. If something breaks, rolling back to the last known-good state takes a single step.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: Lock,
    title: "Token Budget Guardrails",
    description: "Every operation has a token ceiling. When context grows too large, the system compresses it automatically — nothing silently goes over budget.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: AlertTriangle,
    title: "Four-Layer Guard System",
    description: "Before any release, four guards run in parallel: database safety, N+1 query detection, UI/UX compliance, and release readiness. A single block halts the pipeline.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: BarChart2,
    title: "Release Readiness Score",
    description: "Before deployment, the system cross-checks every requirement against code, tests, UI screens, DB entities, and docs. You get a 0–100 readiness score and full traceability matrix.",
    color: "text-lime-400",
    bg: "bg-lime-500/10",
  },
  {
    icon: Route,
    title: "End-to-End Traceability",
    description: "Every task carries acceptance criteria and Definition of Done items. Code is annotated with @req tags. You can trace any requirement to the exact file and test that implements it.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Sparkles,
    title: "Intelligent Prompt Routing",
    description: "Vague prompts are normalized before they reach the pipeline. The prompt-normalizer extracts intent and either routes confidently or asks a single targeted clarification — never guesses.",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Activity,
    title: "Session Observability",
    description: "After every pipeline stage, telemetry is captured — skill latency, HITL outcomes, token usage — and analyzed into a read-only enhancement dashboard. Zero PII. Feeds the adaptation engine.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    icon: Lightbulb,
    title: "Assisted Self-Enhancement",
    description: "The system analyzes its own usage patterns and proposes ranked improvements — new skills, modified pipelines, or retired dead weight. Every proposal requires your approval before anything changes.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: ClipboardList,
    title: "Structured Work Items",
    description: "Every task, bug, review, and change request is a typed work item with a lifecycle state machine. Defect chains link root cause to fix to closure. Export to Jira-compatible format with one command.",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
  },
  {
    icon: Bot,
    title: "Domain Specialist Agents",
    description: "Four specialist agents — AI/LLM systems, Mobile (iOS/Android/RN/Flutter), SaaS & Enterprise (multi-tenant, SOC 2), and Embedded/IoT — auto-route into the pipeline when your project requires them.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Palette,
    title: "Motion & Creative Design",
    description: "Three creative-layer skills cover motion design, UX research synthesis, and creative experience architecture. They run in Phase 2 alongside the core UX architect so visual and functional design stay in sync.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Wand2,
    title: "Gap-to-Skill Pipeline",
    description: "When the orchestrator detects a capability the system can't handle, it fires a gap event. A reactive pipeline drafts a new skill, scores it for quality, and presents it for your approval — before anything is registered.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  // ── Phase 7 — Intelligence Expansion ──────────────────────────────────────
  {
    icon: Diff,
    title: "Behavioral Change Detection",
    description: "Goes beyond line-level diffs to detect logic shifts, contract changes, and security boundary alterations. Feeds precise impact signals to security review and test generation — so tests are rewritten when the contract changes, not just when lines change.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Scale,
    title: "Built-In Compliance Mapping",
    description: "Maps every feature and architecture decision against GDPR, HIPAA, PCI-DSS, SOC 2, and ISO 27001 clauses at design time — before a line of code is written. Produces a traceability matrix, gap report, and audit evidence checklist automatically.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: DollarSign,
    title: "Cloud Cost Intelligence",
    description: "Projects monthly AWS, GCP, and Azure costs directly from the deployment strategy output — before you commit to an architecture. Produces per-provider breakdowns, three alternative configurations, and cost-per-feature attribution.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    icon: PlayCircle,
    title: "Pipeline Dry-Run",
    description: "Runs the full pipeline in simulation mode before any real execution. Every skill fires, outputs are generated in preview form, no disk writes occur. You get a unified report: files that would change, HITL gates that would trigger, block risks, and a go/no-go summary.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Layers2,
    title: "API Lifecycle Management",
    description: "Manages the full API version lifecycle from current to deprecated to sunset. Auto-generates migration guides from breaking changes, creates consumer migration work items, and enforces sunset timelines with automatic violation detection.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: GitFork,
    title: "A/B Architecture Comparison",
    description: "Forks the pipeline at architecture-design into two named branches, runs each through planning and quality skills in parallel, and produces a side-by-side scorecard with a recommendation. A mandatory HITL gate selects the winner before any artifacts are promoted.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-14 text-center"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
          What ASE-OS Does For You
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Every capability is built-in, automatic, and non-bypassable — not a plugin or an option.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            variants={item}
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200"
          >
            <div className={`mb-3 inline-flex rounded-lg ${f.bg} p-2`}>
              <f.icon size={18} className={f.color} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">{f.title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">{f.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

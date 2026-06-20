"use client";
import { motion } from "framer-motion";

const NODES = [
  { id: "install",    label: "Installation",        sublabel: "Clone + open in IDE",             color: "from-zinc-700 to-zinc-600",     accent: "border-zinc-600",  dot: "bg-zinc-400"   },
  { id: "graph",      label: "Context Discovery",   sublabel: "Graphify builds AST graph",       color: "from-teal-700 to-teal-600",     accent: "border-teal-500",  dot: "bg-teal-400"   },
  { id: "prompt",     label: "Prompt Submitted",    sublabel: "User describes feature",           color: "from-violet-700 to-violet-600", accent: "border-violet-500",dot: "bg-violet-400" },
  { id: "analysis",   label: "Analysis",            sublabel: "Normalizer + intent routing",     color: "from-blue-700 to-blue-600",     accent: "border-blue-500",  dot: "bg-blue-400"   },
  { id: "skills",     label: "Skill Invocation",    sublabel: "Agents dispatched per phase",     color: "from-cyan-700 to-cyan-600",     accent: "border-cyan-500",  dot: "bg-cyan-400"   },
  { id: "ai",         label: "AI Processing",       sublabel: "LLM generates artifacts",         color: "from-indigo-700 to-indigo-600", accent: "border-indigo-500",dot: "bg-indigo-400" },
  { id: "validation", label: "Validation",          sublabel: "Review · Tests · Security · Guards",color: "from-amber-700 to-amber-600", accent: "border-amber-500", dot: "bg-amber-400"  },
  { id: "output",     label: "Output Ready",        sublabel: "Code · Docs · Deploy artifacts",  color: "from-green-700 to-green-600",   accent: "border-green-500", dot: "bg-green-400"  },
  { id: "review",     label: "User Review",         sublabel: "Human approval at every gate",    color: "from-pink-700 to-pink-600",     accent: "border-pink-500",  dot: "bg-pink-400"   },
];

// Layout: 3-col grid, row by row
const LAYOUT = [
  // row 0: install (col 1 center)
  { id: "install",    col: 1, row: 0 },
  // row 1: graph (col 0), prompt (col 2)
  { id: "graph",      col: 0, row: 1 },
  { id: "prompt",     col: 2, row: 1 },
  // row 2: analysis center
  { id: "analysis",   col: 1, row: 2 },
  // row 3: skills left, ai right
  { id: "skills",     col: 0, row: 3 },
  { id: "ai",         col: 2, row: 3 },
  // row 4: validation center
  { id: "validation", col: 1, row: 4 },
  // row 5: output left, review right
  { id: "output",     col: 0, row: 5 },
  { id: "review",     col: 2, row: 5 },
];

// Connections: [from, to]
const CONNECTIONS = [
  ["install",    "graph"    ],
  ["install",    "prompt"   ],
  ["graph",      "analysis" ],
  ["prompt",     "analysis" ],
  ["analysis",   "skills"   ],
  ["analysis",   "ai"       ],
  ["skills",     "validation"],
  ["ai",         "validation"],
  ["validation", "output"   ],
  ["validation", "review"   ],
];

const COLS = 3;
const COL_W = 200; // px per column
const ROW_H = 120; // px per row
const NODE_W = 160;
const NODE_H = 64;
const ROWS = 6;
const SVG_W = COLS * COL_W;
const SVG_H = ROWS * ROW_H;

function nodeCenter(id: string) {
  const n = LAYOUT.find((l) => l.id === id);
  if (!n) return { x: 0, y: 0 };
  const x = n.col * COL_W + COL_W / 2;
  const y = n.row * ROW_H + NODE_H / 2;
  return { x, y };
}

export function WorkflowDiagram() {
  return (
    <section className="mb-24">
      {/* Section header */}
      <div className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60 px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono"
        >
          Full Lifecycle Visual
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3"
        >
          Complete Workflow Diagram
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          Every stage from installation to user review, showing how data flows through
          the system and where human decision points appear.
        </motion.p>
      </div>

      {/* Desktop diagram */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="hidden md:block mx-auto max-w-3xl"
      >
        <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-8 overflow-hidden">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-cyan-500/5 blur-[80px]" />
          </div>

          <div className="relative" style={{ width: SVG_W, height: SVG_H, margin: "0 auto" }}>
            {/* SVG layer for connections */}
            <svg
              className="absolute inset-0"
              width={SVG_W}
              height={SVG_H}
              style={{ overflow: "visible" }}
            >
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="currentColor" />
                </marker>
              </defs>
              {CONNECTIONS.map(([from, to]) => {
                const a = nodeCenter(from);
                const b = nodeCenter(to);
                // Curved quadratic bezier path
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const curve = Math.abs(dx) > 10 ? 30 : 0;
                const cx1 = a.x + (dx > 0 ? curve : -curve);
                const cy1 = a.y + dy * 0.4;
                const d = `M ${a.x} ${a.y} Q ${cx1} ${cy1} ${b.x} ${b.y}`;
                return (
                  <motion.path
                    key={`${from}-${to}`}
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-zinc-400 dark:text-zinc-600"
                  />
                );
              })}
            </svg>

            {/* Node layer */}
            {LAYOUT.map((item, i) => {
              const node = NODES.find((n) => n.id === item.id);
              if (!node) return null;
              const x = item.col * COL_W + (COL_W - NODE_W) / 2;
              const y = item.row * ROW_H;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.07 }}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: NODE_W,
                    height: NODE_H,
                  }}
                  className={`rounded-xl border ${node.accent}/40 bg-gradient-to-br ${node.color} p-3 flex flex-col justify-center`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${node.dot}`} />
                    <span className="text-xs font-semibold text-white truncate">{node.label}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 pl-3.5 leading-tight truncate">{node.sublabel}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Mobile fallback: vertical list */}
      <div className="md:hidden space-y-2 max-w-sm mx-auto">
        {NODES.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07 }}
            className={`rounded-xl border ${node.accent}/40 bg-gradient-to-br ${node.color} px-4 py-3 flex items-center gap-3`}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${node.dot}`} />
            <div>
              <div className="text-xs font-semibold text-white">{node.label}</div>
              <div className="text-[10px] text-zinc-400">{node.sublabel}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

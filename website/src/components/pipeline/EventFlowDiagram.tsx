"use client";
import { motion } from "framer-motion";

const EVENTS = [
  { type: "code.changed",        source: "Builder",       handlers: ["clean-code-review", "dependency-analyzer", "change-impact-analyzer"], color: "text-teal-400",   bg: "bg-teal-500/10",   border: "border-teal-500/20"   },
  { type: "architecture.changed",source: "Architect",     handlers: ["architecture-design", "dependency-analyzer", "change-impact-analyzer"], color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20"   },
  { type: "test.failed",         source: "Test Runner",   handlers: ["code-repair"],                                                          color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  { type: "security.finding",    source: "Security Review",handlers: ["security-review"],                                                    color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { type: "file.written",        source: "Any skill",     handlers: ["doc-maintainer"],                                                       color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/20"   },
  { type: "context.pressure_high",source: "Orchestrator", handlers: ["context-compressor"],                                                  color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
];

export function EventFlowDiagram() {
  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Event-Driven Execution</h2>
        <p className="text-zinc-400 max-w-xl mx-auto text-sm">
          Every change emits a structured event. The event-router dispatches each event to its registered skill handlers — no manual chaining required.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {EVENTS.map((e, i) => (
          <motion.div
            key={e.type}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07 }}
            className={`rounded-xl border ${e.border} ${e.bg} p-4`}
          >
            <div className={`font-mono text-xs font-bold ${e.color} mb-1`}>{e.type}</div>
            <div className="text-xs text-zinc-500 mb-3">emitted by: {e.source}</div>
            <div className="flex flex-col gap-1.5">
              {e.handlers.map((h) => (
                <div key={h} className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className={`h-1 w-1 rounded-full ${e.color.replace("text-", "bg-")}`} />
                  {h}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

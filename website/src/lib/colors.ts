// Domain colors — consistent across all pages
// When a new domain is added to the skill registry, add it here.
export const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  requirements:   { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/30",  dot: "bg-violet-400"  },
  architecture:   { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "border-cyan-500/30",    dot: "bg-cyan-400"    },
  planning:       { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/30",    dot: "bg-blue-400"    },
  review:         { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30",   dot: "bg-amber-400"   },
  testing:        { bg: "bg-green-500/10",   text: "text-green-400",   border: "border-green-500/30",   dot: "bg-green-400"   },
  security:       { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30",     dot: "bg-red-400"     },
  deployment:     { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/30",  dot: "bg-orange-400"  },
  documentation:  { bg: "bg-pink-500/10",    text: "text-pink-400",    border: "border-pink-500/30",    dot: "bg-pink-400"    },
  meta:           { bg: "bg-slate-500/10",   text: "text-slate-400",   border: "border-slate-500/30",   dot: "bg-slate-400"   },
  orchestration:  { bg: "bg-indigo-500/10",  text: "text-indigo-400",  border: "border-indigo-500/30",  dot: "bg-indigo-400"  },
  implementation: { bg: "bg-teal-500/10",    text: "text-teal-400",    border: "border-teal-500/30",    dot: "bg-teal-400"    },
  design:         { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", border: "border-fuchsia-500/30", dot: "bg-fuchsia-400" },
  database:       { bg: "bg-sky-500/10",     text: "text-sky-400",     border: "border-sky-500/30",     dot: "bg-sky-400"     },
  quality:        { bg: "bg-lime-500/10",    text: "text-lime-400",    border: "border-lime-500/30",    dot: "bg-lime-400"    },
  governance:     { bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/30",    dot: "bg-rose-400"    },
  system:         { bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/30",  dot: "bg-yellow-400"  },
  "domain-specialist": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", dot: "bg-purple-400" },
};

export const MASTERY_COLORS: Record<string, string> = {
  beginner:     "text-green-400 border-green-500/30 bg-green-500/10",
  intermediate: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  advanced:     "text-red-400 border-red-500/30 bg-red-500/10",
};

export const LAYER_LABELS: Record<string, string> = {
  "pipeline-entry":     "Entry",
  "pipeline-core":      "Core",
  "pipeline-quality":   "Quality",
  "pipeline-execution": "Execution",
  "pipeline-safety":    "Safety",
  "infrastructure":     "Infrastructure",
  "meta":               "Meta",
};

export const PHASE_COLORS = [
  "from-violet-600 to-violet-500",
  "from-cyan-600 to-cyan-500",
  "from-blue-600 to-blue-500",
  "from-indigo-600 to-indigo-500",
  "from-purple-600 to-purple-500",
  "from-teal-600 to-teal-500",
  "from-green-600 to-green-500",
  "from-amber-600 to-amber-500",
  "from-orange-600 to-orange-500",
  "from-pink-600 to-pink-500",
];

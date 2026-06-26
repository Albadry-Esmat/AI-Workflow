"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Globe, ExternalLink, ArrowRight } from "lucide-react";

/* ── Inline brand SVGs (lucide-react v1.20 removed brand icons) ── */
function GitHubIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function XIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.258 5.63 5.907-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function YouTubeIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Social media links
───────────────────────────────────────────────────────────── */
const SOCIAL_LINKS = [
  {
    platform: "GitHub",
    handle: "@albadryesmat",
    description: "Open-source projects, code, and repositories",
    href: "https://github.com/albadryesmat",
    Icon: GitHubIcon,
    color: "text-zinc-900 dark:text-white",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    border: "border-zinc-300 dark:border-zinc-700",
    hoverBorder: "hover:border-zinc-500 dark:hover:border-zinc-500",
    badge: "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300",
  },
  {
    platform: "X / Twitter",
    handle: "@albadryesmat",
    description: "Thoughts on AI, engineering, and building in public",
    href: "https://x.com/albadryesmat",
    Icon: XIcon,
    color: "text-zinc-900 dark:text-white",
    bg: "bg-zinc-50 dark:bg-zinc-900/60",
    border: "border-zinc-300 dark:border-zinc-700",
    hoverBorder: "hover:border-zinc-600 dark:hover:border-zinc-500",
    badge: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
  },
  {
    platform: "LinkedIn",
    handle: "Albadry Esmat",
    description: "Professional background, experience, and network",
    href: "https://linkedin.com/in/albadryesmat",
    Icon: LinkedInIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    hoverBorder: "hover:border-blue-400 dark:hover:border-blue-500",
    badge: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300",
  },
  {
    platform: "YouTube",
    handle: "@albadryesmat",
    description: "Videos on AI engineering, system design, and tutorials",
    href: "https://youtube.com/@albadryesmat",
    Icon: YouTubeIcon,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    hoverBorder: "hover:border-red-400 dark:hover:border-red-500",
    badge: "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300",
  },
  {
    platform: "Instagram",
    handle: "@albadryesmat",
    description: "Behind the scenes, projects, and personal updates",
    href: "https://instagram.com/albadryesmat",
    Icon: InstagramIcon,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800",
    hoverBorder: "hover:border-pink-400 dark:hover:border-pink-500",
    badge: "bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300",
  },
  {
    platform: "Personal Website",
    handle: "albadryesmat.com",
    description: "Portfolio, writing, and everything I'm working on",
    href: "https://albadryesmat.com",
    Icon: Globe,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-200 dark:border-cyan-800",
    hoverBorder: "hover:border-cyan-400 dark:hover:border-cyan-500",
    badge: "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300",
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export function AboutContent() {
  return (
    <div className="min-h-screen">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden grid-bg py-24 px-6 text-center">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
          <div className="absolute h-[300px] w-[300px] rounded-full bg-violet-500/5 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-10 mx-auto max-w-2xl"
        >
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 via-violet-500 to-pink-500 text-3xl font-black text-white shadow-xl"
          >
            AE
          </motion.div>

          {/* Name */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2"
          >
            Albadry Esmat
          </motion.h1>

          {/* Title */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-medium bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500 bg-clip-text text-transparent mb-4"
          >
            Creator of ASE-OS
          </motion.p>

          {/* Bio */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8 text-base"
          >
            I build AI systems that do real engineering work — not just assistants that answer
            questions. ASE-OS is my attempt to create a complete, skill-driven operating system
            for software development: one that designs, generates, tests, reviews, and deploys
            code autonomously, with full traceability and no documentation drift.
          </motion.p>

          {/* Hero CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <a
              href="https://albadryesmat.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors"
            >
              <Globe size={15} />
              Visit My Website
            </a>
            <a
              href="https://github.com/albadryesmat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <GitHubIcon size={15} />
              Follow on GitHub
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Follow CTA banner ────────────────────────────────────── */}
      <section className="border-y border-cyan-200 dark:border-cyan-900/40 bg-gradient-to-r from-cyan-50 via-violet-50 to-pink-50 dark:from-cyan-950/30 dark:via-violet-950/30 dark:to-pink-950/30 py-8 px-6">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="text-zinc-900 dark:text-white font-semibold text-base">
              Stay in the loop
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-0.5">
              Follow me for updates on ASE-OS, AI engineering patterns, and new features as they ship.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://x.com/albadryesmat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors"
            >
              <XIcon size={14} />
              Follow on X
            </a>
            <a
              href="https://linkedin.com/in/albadryesmat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-400 px-5 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
            >
              <LinkedInIcon size={14} />
              Connect on LinkedIn
            </a>
          </div>
        </div>
      </section>

      {/* ── Social links grid ────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
            Find Me Online
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Connect, follow, or reach out — I&apos;d love to hear from you.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {SOCIAL_LINKS.map((link) => (
            <motion.a
              key={link.platform}
              variants={item}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative rounded-xl border ${link.border} ${link.bg} ${link.hoverBorder} p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col gap-3`}
            >
              {/* Icon + platform */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${link.bg} border ${link.border}`}>
                    <link.Icon size={18} className={link.color} />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${link.color}`}>{link.platform}</div>
                    <div className={`text-xs font-mono px-1.5 py-0.5 rounded ${link.badge} mt-0.5 inline-block`}>
                      {link.handle}
                    </div>
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors"
                />
              </div>

              {/* Description */}
              <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
                {link.description}
              </p>

              {/* Follow button */}
              <div
                className={`mt-auto inline-flex items-center gap-1.5 text-xs font-semibold ${link.color} group-hover:gap-2.5 transition-all`}
              >
                Follow
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.a>
          ))}
        </motion.div>
      </section>

      {/* ── ASE-OS project CTA ───────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 dark:from-zinc-900 to-zinc-100 dark:to-zinc-950 p-10 text-center"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-cyan-500/10 blur-[70px]" />
          </div>
          <h3 className="relative text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            Explore ASE-OS
          </h3>
          <p className="relative text-zinc-600 dark:text-zinc-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Dive into the skill system, pipeline architecture, and how ASE-OS takes ideas
            all the way to deployed software — automatically.
          </p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link
              href="/how-it-works"
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/skills"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 px-6 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Browse Skills
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

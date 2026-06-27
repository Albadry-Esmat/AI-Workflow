/**
 * site.config.ts — single source of truth for all site-wide URLs and
 * configurable values.
 *
 * Override at deploy time via environment variables:
 *   NEXT_PUBLIC_SITE_URL   — canonical URL of the deployed site
 *   NEXT_PUBLIC_REPO_URL   — GitHub repository URL
 *
 * Creator identity (shown on the About page and site footer):
 *   NEXT_PUBLIC_CREATOR_NAME     — your full name
 *   NEXT_PUBLIC_CREATOR_TITLE    — short title / role description
 *   NEXT_PUBLIC_CREATOR_BIO      — one-paragraph bio
 *   NEXT_PUBLIC_CREATOR_INITIALS — 2-letter avatar initials
 *
 * Social links (set any to "" to hide that card on the About page):
 *   NEXT_PUBLIC_CREATOR_GITHUB_HANDLE / NEXT_PUBLIC_CREATOR_GITHUB_URL
 *   NEXT_PUBLIC_CREATOR_TWITTER_HANDLE / NEXT_PUBLIC_CREATOR_TWITTER_URL
 *   NEXT_PUBLIC_CREATOR_LINKEDIN_HANDLE / NEXT_PUBLIC_CREATOR_LINKEDIN_URL
 *   NEXT_PUBLIC_CREATOR_YOUTUBE_HANDLE / NEXT_PUBLIC_CREATOR_YOUTUBE_URL
 *   NEXT_PUBLIC_CREATOR_INSTAGRAM_HANDLE / NEXT_PUBLIC_CREATOR_INSTAGRAM_URL
 *   NEXT_PUBLIC_CREATOR_WEBSITE_HANDLE / NEXT_PUBLIC_CREATOR_WEBSITE_URL
 *
 * NEXT_PUBLIC_* variables are replaced at build time and are safe to use
 * in both server and client components.
 */

// ─── Site URLs ───────────────────────────────────────────────────────────────

/** Canonical URL of the deployed website (no trailing slash). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-project.vercel.app";

/** GitHub repository URL for the main system repo. */
export const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL ??
  "https://github.com/your-username/ai-workflow";

/** Directory name derived from the repo URL (used in clone commands). */
export const REPO_NAME = REPO_URL.split("/").pop() ?? "ai-workflow";

// ─── Creator identity ─────────────────────────────────────────────────────────
// Set these via environment variables (NEXT_PUBLIC_CREATOR_*) to personalise
// the About page and site footer without touching source code.

export const CREATOR_NAME     = process.env.NEXT_PUBLIC_CREATOR_NAME     ?? "Your Name";
export const CREATOR_TITLE    = process.env.NEXT_PUBLIC_CREATOR_TITLE    ?? "Creator of AI Workflow";
export const CREATOR_BIO      = process.env.NEXT_PUBLIC_CREATOR_BIO      ?? "Set NEXT_PUBLIC_CREATOR_BIO in your .env.local to add your bio here.";
export const CREATOR_INITIALS = process.env.NEXT_PUBLIC_CREATOR_INITIALS ?? "YN";

// Social links — empty string = card hidden on the About page.
export const CREATOR_GITHUB_HANDLE    = process.env.NEXT_PUBLIC_CREATOR_GITHUB_HANDLE    ?? "";
export const CREATOR_GITHUB_URL       = process.env.NEXT_PUBLIC_CREATOR_GITHUB_URL       ?? "";
export const CREATOR_TWITTER_HANDLE   = process.env.NEXT_PUBLIC_CREATOR_TWITTER_HANDLE   ?? "";
export const CREATOR_TWITTER_URL      = process.env.NEXT_PUBLIC_CREATOR_TWITTER_URL      ?? "";
export const CREATOR_LINKEDIN_HANDLE  = process.env.NEXT_PUBLIC_CREATOR_LINKEDIN_HANDLE  ?? "";
export const CREATOR_LINKEDIN_URL     = process.env.NEXT_PUBLIC_CREATOR_LINKEDIN_URL     ?? "";
export const CREATOR_YOUTUBE_HANDLE   = process.env.NEXT_PUBLIC_CREATOR_YOUTUBE_HANDLE   ?? "";
export const CREATOR_YOUTUBE_URL      = process.env.NEXT_PUBLIC_CREATOR_YOUTUBE_URL      ?? "";
export const CREATOR_INSTAGRAM_HANDLE = process.env.NEXT_PUBLIC_CREATOR_INSTAGRAM_HANDLE ?? "";
export const CREATOR_INSTAGRAM_URL    = process.env.NEXT_PUBLIC_CREATOR_INSTAGRAM_URL    ?? "";
export const CREATOR_WEBSITE_HANDLE   = process.env.NEXT_PUBLIC_CREATOR_WEBSITE_HANDLE   ?? "";
export const CREATOR_WEBSITE_URL      = process.env.NEXT_PUBLIC_CREATOR_WEBSITE_URL      ?? "";

/**
 * site.config.ts — single source of truth for all site-wide URLs and
 * configurable values.
 *
 * Override at deploy time via environment variables:
 *   NEXT_PUBLIC_SITE_URL   — canonical URL of the deployed site
 *   NEXT_PUBLIC_REPO_URL   — GitHub repository URL
 *
 * NEXT_PUBLIC_* variables are replaced at build time and are safe to use
 * in both server and client components.
 */

/** Canonical URL of the deployed website (no trailing slash). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ase-os.vercel.app";

/** GitHub repository URL for the main system repo. */
export const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL ??
  "https://github.com/Albadry-Esmat/AI-Workflow";

/** Directory name derived from the repo URL (used in clone commands). */
export const REPO_NAME = REPO_URL.split("/").pop() ?? "AI-Workflow";

# ASE-OS Website

This is the official marketing and documentation website for [ASE-OS — AI Software Engineering OS](https://github.com/Albadry-Esmat/AI-Workflow), built with [Next.js 15](https://nextjs.org) and [Tailwind CSS v4](https://tailwindcss.com).

## What This Repo Is

This repo contains only the **website source** (`website/` from the main monorepo, mirrored here). It documents and showcases the ASE-OS skill system but **does not contain the skill files themselves**.

To use ASE-OS, clone the main system repo:

```bash
git clone https://github.com/Albadry-Esmat/AI-Workflow.git
```

## Local Development

> **Prerequisite:** Node.js 20+

```bash
# From this directory
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note for local dev:** The website reads skill data from the parent `AI-Workflow` directory at build time. If you run the website standalone (outside the monorepo), data pages will fall back to empty values. Run from inside the monorepo for full data:
>
> ```bash
> # From the AI-Workflow root:
> cd website && npm run dev
> ```

## Build & Deploy

```bash
npm run build   # production build
npm start       # serve production build locally
```

The site is deployed automatically to [Vercel](https://vercel.com) on every push to `main` of the main monorepo. The Vercel project is configured with `website/` as the root directory.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, static export) |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Data | Static generation from YAML/JSON files in the main repo |
| Deployment | Vercel |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, features, stats |
| `/getting-started` | Setup guide with live skill/agent counts |
| `/skills` | Browsable skill catalog (all 100+ skills) |
| `/how-it-works` | Full pipeline walkthrough |
| `/agents` | Agent roster and responsibilities |
| `/changelog` | Auto-generated from `docs/changelog.md` |

## Contributing

UI/website changes → open a PR against the main repo at [AI-Workflow](https://github.com/Albadry-Esmat/AI-Workflow). Changes to skill files, registry, and pipeline templates live there, not here.

## Links

- **Main System Repo:** https://github.com/Albadry-Esmat/AI-Workflow
- **Live Website:** https://ase-os.vercel.app *(or your Vercel domain)*
- **Getting Started:** https://ase-os.vercel.app/getting-started

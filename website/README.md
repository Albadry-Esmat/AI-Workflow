# ASE-OS Website

Official documentation and marketing website for [ASE-OS — AI Software Engineering Operating System](https://github.com/Albadry-Esmat/AI-Workflow).

Built with [Next.js 15](https://nextjs.org) (App Router, static generation) and [Tailwind CSS v4](https://tailwindcss.com).

**Live site:** https://ase-os.vercel.app

---

## Quick Start (Standalone)

This repository is **self-contained** — all skill data, registry files, pipeline templates, and agent config are bundled in `data/`. Clone it and you're ready to build:

```bash
git clone https://github.com/Albadry-Esmat/ase-os-website.git
cd ase-os-website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Node.js 20+** required.

---

## How Data Works

The website reads skill and pipeline data from the file system at build time. It auto-detects the data source:

| Mode | When | Data path |
|------|------|-----------|
| **Standalone** | `data/skills/index.yaml` exists in this repo | `./data/` |
| **Monorepo** | Running inside the `AI-Workflow` parent repo | `../` (parent directory) |
| **Override** | `DATA_ROOT` env var is set | `$DATA_ROOT` |

This means you can clone this repo and `npm run build` works immediately — no parent repo required.

---

## Environment Variables

Copy `.env.example` to `.env.local` to override defaults:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://ase-os.vercel.app` | Canonical site URL (used in metadata, sitemap, robots.txt) |
| `NEXT_PUBLIC_REPO_URL` | `https://github.com/Albadry-Esmat/AI-Workflow` | GitHub repo URL (used in GitHub buttons) |
| `DATA_ROOT` | *(auto-detect)* | Override the data directory path |

---

## Build & Deploy

```bash
npm run build   # production build — static site generation
npm start       # serve the production build locally
```

The site deploys automatically to [Vercel](https://vercel.com) on every push to `main` of the main [AI-Workflow](https://github.com/Albadry-Esmat/AI-Workflow) monorepo (configured with `website/` as root directory).

---

## Keeping Data Current

This repo bundles a snapshot of the skill registry. To sync with the latest data from the main repo:

```bash
# 1 — clone (or pull) the main system repo
git clone https://github.com/Albadry-Esmat/AI-Workflow.git

# 2 — copy the data snapshot into this repo
rsync -av --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.next' \
  AI-Workflow/website/ ase-os-website/

# 3 — commit the updated data
cd ase-os-website && git add . && git commit -m "sync: update data snapshot"
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, static generation) |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Data | Static generation from bundled YAML/JSON in `data/` |
| Deployment | Vercel |

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, features, live stats |
| `/how-it-works` | Full pipeline walkthrough with diagrams |
| `/skills` | Browsable skill catalog |
| `/skills/[id]` | Individual skill specification page |
| `/pipelines` | All pipeline templates |
| `/agents` | Agent roster and responsibilities |
| `/architecture` | System architecture overview |
| `/reference` | Quick-reference index |
| `/changelog` | Auto-generated from `data/docs/changelog.md` |
| `/getting-started` | Setup guide with live skill/agent counts |
| `/about` | About the project |

---

## Contributing

UI and website changes → open a PR against the main repo at [AI-Workflow](https://github.com/Albadry-Esmat/AI-Workflow). Skill files, registry, and pipeline templates live there.

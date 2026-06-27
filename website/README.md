# AI Workflow — Website

Official documentation and interactive skill catalog for [AI Workflow](https://github.com/your-username/ai-workflow).

Built with [Next.js 15](https://nextjs.org) (App Router, static generation) and [Tailwind CSS v4](https://tailwindcss.com).

---

## Quick Start (Monorepo)

If you cloned the main `ai-workflow` repo, the website is already included:

```bash
cd website
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
| **Monorepo** | Running inside the `ai-workflow` parent repo | `../` (parent directory) |
| **Standalone** | `data/skills/index.yaml` exists in this repo | `./data/` |
| **Override** | `DATA_ROOT` env var is set | `$DATA_ROOT` |

In monorepo mode (the default), `npm run build` works immediately — it reads `../skills/index.yaml` and all other data from the parent directory.

---

## Environment Variables

Copy `.env.example` to `.env.local` to override defaults:

```bash
cp .env.example .env.local
```

### Site URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` | Canonical site URL (metadata, sitemap, robots.txt) |
| `NEXT_PUBLIC_REPO_URL` | `https://github.com/your-username/ai-workflow` | GitHub repo URL (shown in GitHub buttons) |
| `DATA_ROOT` | *(auto-detect)* | Override the data directory path |

### Creator Identity (About page & footer)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_CREATOR_NAME` | `Your Name` | Full name shown in footer and About page |
| `NEXT_PUBLIC_CREATOR_TITLE` | `Creator of AI Workflow` | Role / subtitle on About page |
| `NEXT_PUBLIC_CREATOR_BIO` | *(placeholder)* | Bio paragraph on About page |
| `NEXT_PUBLIC_CREATOR_INITIALS` | `YN` | Two-letter avatar initials |
| `NEXT_PUBLIC_CREATOR_GITHUB_URL` | `""` | GitHub profile URL (empty = card hidden) |
| `NEXT_PUBLIC_CREATOR_TWITTER_URL` | `""` | X / Twitter URL (empty = card hidden) |
| `NEXT_PUBLIC_CREATOR_LINKEDIN_URL` | `""` | LinkedIn URL (empty = card hidden) |
| `NEXT_PUBLIC_CREATOR_YOUTUBE_URL` | `""` | YouTube URL (empty = card hidden) |
| `NEXT_PUBLIC_CREATOR_INSTAGRAM_URL` | `""` | Instagram URL (empty = card hidden) |
| `NEXT_PUBLIC_CREATOR_WEBSITE_URL` | `""` | Personal website URL (empty = card hidden) |

Each `*_URL` variable has a matching `*_HANDLE` variable for the display text (e.g. `@your-github`). See `.env.example` for the full list.

---

## Build & Deploy

```bash
npm run build   # production build — static site generation
npm start       # serve the production build locally
```

Deploy to [Vercel](https://vercel.com) by pointing the project root to `website/` in your Vercel project settings. Set all `NEXT_PUBLIC_*` variables in Vercel's environment variable panel.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, features, live stats |
| `/how-it-works` | Full pipeline walkthrough with diagrams |
| `/skills` | Browsable skill catalog |
| `/skills/[id]` | Individual skill specification page (101 pages) |
| `/pipelines` | All pipeline templates |
| `/agents` | Agent roster and responsibilities |
| `/architecture` | System architecture overview |
| `/reference` | Quick-reference index |
| `/changelog` | Auto-generated from `data/docs/changelog.md` |
| `/getting-started` | Setup guide with live skill/agent counts |
| `/about` | About the creator (driven by `NEXT_PUBLIC_CREATOR_*` vars) |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, static generation) |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Data | Static generation from bundled YAML/JSON |
| Deployment | Vercel |

---

## Contributing

Website and UI changes → open a PR against the main [ai-workflow](https://github.com/your-username/ai-workflow) repo. Skill files, registry, and pipeline templates also live there. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full guide.

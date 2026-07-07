# Repo Movie Machine

[中文文档](./README.zh-CN.md)

## Product Introduction

Repo Movie Machine is a compact creative developer tool that turns a public GitHub repository into a playable commit and star trend movie.

Users paste a GitHub repository such as `owner/repo`, the server fetches repository metadata and commit history, the analyzer builds a reusable `RepoMovie` JSON model, and the browser renders an animated timeline with commit count, historical stars, current commit details, changed files, sharing, and export controls.

Current capabilities:

- Public GitHub repository input in these forms: `https://github.com/owner/repo`, `github.com/owner/repo`, or `owner/repo`.
- Commit limits: `30`, `100`, `250`, `500`, or `All`. Default: `100`.
- Server-side GitHub API access with optional `GITHUB_TOKEN`; tokens are never exposed to browser code.
- Summary mode without a token, so larger histories can still load under low unauthenticated API limits.
- Real GitHub stargazer timeline when `GITHUB_TOKEN` is available, with estimated star-trend fallback.
- Bilingual English/Chinese UI with an in-page language switch.
- Shareable local movie route, query loading, JSON export, PNG snapshot export, and browser-side WebM recording.

## Local Deployment Tutorial

Requirements:

- Node.js 20+
- npm
- Optional GitHub token for higher API limits and historical star data

Install and run locally:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional `.env.local`:

```bash
GITHUB_TOKEN=github_pat_or_classic_token_here
```

Validate the project:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

For production hosting, Vercel is the simplest target for the current Next.js app. Set `GITHUB_TOKEN` in project environment variables, then use `npm run build`. The current job and movie stores are in memory, so durable storage such as Redis, Vercel KV, Upstash, Postgres, Cloudflare KV, D1, or Durable Objects is recommended before relying on persistent public share links.

## Web Usage

1. Enter a public GitHub repository in the left panel.
2. Choose a commit limit. Start with `30` or `100` for very large repositories.
3. Press the play button to generate the movie.
4. Use play/pause, jump, speed, curve style, theme, and the timeline scrubber to inspect the animation.
5. Click the language control to switch between English and Chinese.
6. Click commits in the trail or files in the visualization to inspect the current change context.
7. Export the `RepoMovie` JSON, save a PNG snapshot, record a WebM clip, or copy the share link when a generated movie is loaded.

Useful manual targets:

- `octocat/Hello-World`
- `vercel/next.js` with 30 commits first
- Invalid input such as `https://example.com/a/b`
- Missing repo such as `octocat/does-not-exist-repo`
- No `GITHUB_TOKEN`
- With `GITHUB_TOKEN`
- Desktop and mobile viewports

## Simple Technical Notes

The app uses Next.js App Router, TypeScript, React, Tailwind CSS, Canvas, lucide-react, Vitest, and Playwright.

High-level structure:

```text
app/                  routes and API endpoints
components/           workspace, player, canvas, panels, bilingual UI
lib/github/           GitHub URL parsing and REST API client
lib/jobs/             in-memory job queue/store and cache keys
lib/movie/            RepoMovie model, parser, trend math, recording helpers
lib/storage/          in-memory movie storage
lib/security/         input limits and cooldowns
worker/               async analysis workflow
tests/                unit, component, and e2e coverage
```

Important limitations:

- Jobs and movie artifacts are stored in process memory.
- Share links survive only while the same server process keeps the in-memory result.
- Without `GITHUB_TOKEN`, movies use commit-list summaries and synthetic `.repo/activity/*` files rather than exact per-file commit details.
- The analyzer uses the GitHub API only; it does not clone repositories.
- Very large repositories may require many commit-list pages in `All` mode.
- MP4 export is not included. WebM is browser-side only.

Recommended next upgrades:

- Durable job and movie storage.
- Worker-backed analysis with queue retries and cancellation.
- Optional clone-based analyzer for richer full-history timelines.
- Persistent public movie slugs independent of in-memory job IDs.
- Server-side render/export pipeline for MP4.

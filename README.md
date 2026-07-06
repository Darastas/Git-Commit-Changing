# Repo Movie Machine

Repo Movie Machine is a compact creative developer tool that turns a public GitHub repository into a playable "code city movie." Users paste a repository URL, the server fetches recent GitHub commit history, the analyzer builds a durable `RepoMovie` JSON model, and the browser renders an animated 2D city timeline.

## What Works

- Public GitHub repo input in these forms:
  - `https://github.com/owner/repo`
  - `http://github.com/owner/repo`
  - `github.com/owner/repo`
  - `owner/repo`
- Server-side GitHub API analyzer with optional `GITHUB_TOKEN`.
- Async job abstraction with in-memory queue/store.
- Movie cache keyed by provider, owner, repo, branch, latest SHA, and commit limit.
- Commit limits: 30, 60, 100. Default: 60.
- 2D code city player:
  - directory districts
  - file buildings
  - language colors
  - size and activity scores
  - changed-file glow and commit wave effects
  - play, pause, scrub, speed, jump start/end
  - commit panel and file inspector
- Shareable local movie route: `/movie/[jobId]`.
- Query loading: `/?repo=owner/repo`.
- Export:
  - `RepoMovie` JSON
  - PNG canvas snapshot
  - browser-side WebM recording when the browser supports `MediaRecorder`
- Tests for URL parsing, language inference, parser transformations, cache keys, error mapping, job storage, limits, and layout.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app includes a sample movie, so the player works before a live repository is loaded.

## GitHub Token

`GITHUB_TOKEN` is optional but recommended. Without it, GitHub's unauthenticated API rate limits are much lower.

Create `.env.local`:

```bash
GITHUB_TOKEN=github_pat_or_classic_token_here
```

The token is only read inside server-side route/worker code. It is never serialized into browser props and is not used by client components.

Token permissions for public repositories can be minimal. A fine-grained token with public repository metadata access is enough for this MVP.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Manual targets:

- `octocat/Hello-World`
- `vercel/next.js` with 30 commits first
- invalid input such as `https://example.com/a/b`
- missing repo such as `octocat/does-not-exist-repo`
- no `GITHUB_TOKEN`
- with `GITHUB_TOKEN`
- desktop viewport
- mobile viewport

## Deployment

### Vercel

Vercel is the simplest deployment target for the current Next.js App Router app.

1. Push the repository to GitHub.
2. Import it in Vercel.
3. Set `GITHUB_TOKEN` in Project Settings → Environment Variables.
4. Build command: `npm run build`.
5. Output is handled by Next.js automatically.

Important: the current job store and movie storage are in-memory. They work for local development and a single warm server process, but serverless instances can evict memory. For production sharing, replace the adapters in `lib/jobs` and `lib/storage` with Redis, Vercel KV, Upstash, Postgres, or another durable store.

### Cloudflare Pages

Cloudflare Pages can host the app with a Next.js adapter such as OpenNext for Cloudflare.

Recommended path:

1. Use the Cloudflare/OpenNext adapter for Next.js App Router.
2. Set `GITHUB_TOKEN` as an encrypted environment variable.
3. Replace in-memory job/movie storage with Cloudflare KV, D1, or Durable Objects.
4. Move long-running analysis into a Worker queue when analyzing larger repositories.

The API-based analyzer is serverless-friendly because it uses the GitHub API instead of local `git clone`.

## Architecture

```text
app/
  page.tsx
  movie/[jobId]/page.tsx
  api/jobs
  api/movies
components/
  RepoInput.tsx
  JobStatus.tsx
  MoviePlayer.tsx
  CodeCityCanvas.tsx
  Timeline.tsx
  CommitPanel.tsx
  FileInspector.tsx
  ExampleGallery.tsx
lib/
  github/
  jobs/
  movie/
  storage/
  security/
worker/
  analyze-job.ts
tests/
  fixtures/
```

Boundaries are intentionally separate: GitHub access, validation, job management, storage, parser/model generation, layout, and rendering are isolated so each can be replaced independently.

## Limitations

- Jobs and movie artifacts are stored in process memory.
- Share links survive only while the same server process keeps the in-memory result.
- Commit details are fetched sequentially to stay simple and gentle on GitHub rate limits.
- The analyzer uses recent GitHub API commits only; it does not clone full repository history.
- Very large repositories should use the 30-commit setting first.
- MP4 export is not included. WebM is browser-side only.

## Production Upgrade Roadmap

- Durable job and movie storage.
- Worker-backed analyzer with queue retries and cancellation.
- Optional clone-based analyzer for richer full-history timelines.
- Persistent public movie slugs independent of job IDs.
- Server-side render/export pipeline for MP4.
- Better contributor and directory-level filtering.
- Abuse controls backed by durable rate limiting.

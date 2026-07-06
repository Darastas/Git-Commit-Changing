import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryJobStore, getJobStore } from "@/lib/jobs/in-memory-job-store";
import { createAnalysisJob } from "@/lib/jobs/queue";
import { InMemoryMovieStorage } from "@/lib/storage/in-memory-storage";
import { ALL_COMMITS_LIMIT, enforceRequestCooldown, normalizeCommitLimit } from "@/lib/security/limits";
import { analyzeJob } from "@/worker/analyze-job";

describe("InMemoryJobStore", () => {
  it("creates queued jobs and allows progress updates without losing immutable fields", async () => {
    const store = new InMemoryJobStore();
    const job = await store.create({
      repo: "octocat/Hello-World",
      normalizedRepo: "octocat/Hello-World",
      commitLimit: 60
    });

    await store.update(job.id, {
      status: "running",
      progressStage: "fetching-repo",
      progressPercent: 20
    });

    const updated = await store.get(job.id);
    expect(updated).toMatchObject({
      id: job.id,
      repo: "octocat/Hello-World",
      normalizedRepo: "octocat/Hello-World",
      status: "running",
      progressStage: "fetching-repo",
      progressPercent: 20
    });
    expect(updated?.createdAt).toBe(job.createdAt);
    expect(updated?.updatedAt).not.toBe(job.updatedAt);
  });
});

describe("InMemoryMovieStorage", () => {
  it("stores movies by stable storage key", async () => {
    const storage = new InMemoryMovieStorage();
    const movie = { version: "1.0" } as never;

    await storage.set("github:octocat:hello-world:main:sha:30", movie);

    await expect(storage.get("github:octocat:hello-world:main:sha:30")).resolves.toBe(movie);
    await expect(storage.get("missing")).resolves.toBeUndefined();
  });
});

describe("normalizeCommitLimit", () => {
  it("allows expanded commit limits and defaults to 100", () => {
    expect(normalizeCommitLimit(undefined)).toBe(100);
    expect(normalizeCommitLimit(30)).toBe(30);
    expect(normalizeCommitLimit(100)).toBe(100);
    expect(normalizeCommitLimit(250)).toBe(250);
    expect(normalizeCommitLimit(500)).toBe(500);
    expect(normalizeCommitLimit(ALL_COMMITS_LIMIT)).toBe(ALL_COMMITS_LIMIT);
    expect(() => normalizeCommitLimit(10)).toThrow(/30, 100, 250, 500, or All/);
  });
});

describe("enforceRequestCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  it("blocks repeated submissions from the same key inside the cooldown window", () => {
    const state = new Map<string, number>();

    expect(enforceRequestCooldown("local", state)).toBe(true);
    expect(enforceRequestCooldown("local", state)).toBe(false);

    vi.advanceTimersByTime(12_000);
    expect(enforceRequestCooldown("local", state)).toBe(true);
  });
});

describe("createAnalysisJob", () => {
  it("normalizes repo input before storing the job", async () => {
    const store = new InMemoryJobStore();

    const job = await createAnalysisJob({
      repo: "https://github.com/octocat/Hello-World",
      commitLimit: 30,
      jobStore: store,
      autoStart: false
    });

    expect(job).toMatchObject({
      repo: "https://github.com/octocat/Hello-World",
      normalizedRepo: "octocat/Hello-World",
      commitLimit: 30,
      status: "queued"
    });
  });
});

describe("analyzeJob", () => {
  it("uses summary commits without per-commit detail fan-out when GITHUB_TOKEN is absent", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith("/repos/octocat/rate-limit-lab")) {
        return Response.json({
          owner: { login: "octocat" },
          name: "rate-limit-lab",
          full_name: "octocat/rate-limit-lab",
          html_url: "https://github.com/octocat/rate-limit-lab",
          default_branch: "main",
          description: "Rate limit fixture",
          stargazers_count: 12,
          language: "TypeScript",
          archived: false
        });
      }

      if (url.endsWith("/repos/octocat/rate-limit-lab/branches/main")) {
        return Response.json({ commit: { sha: "latest000" } });
      }

      if (url.includes("/repos/octocat/rate-limit-lab/commits?")) {
        return Response.json([
          {
            sha: "cccc3333",
            commit: {
              message: "Sketch the first city blocks",
              author: { name: "Ada", date: "2024-01-01T00:00:00Z" }
            },
            author: { login: "ada", avatar_url: "https://example.com/ada.png" }
          },
          {
            sha: "dddd4444",
            commit: {
              message: "Tune playback controls",
              author: { name: "Lin", date: "2024-01-02T00:00:00Z" }
            },
            author: { login: "lin", avatar_url: "https://example.com/lin.png" }
          }
        ]);
      }

      return new Response("unexpected request", { status: 500 });
    });

    try {
      const job = await getJobStore().create({
        repo: "octocat/rate-limit-lab",
        normalizedRepo: "octocat/rate-limit-lab",
        commitLimit: 60
      });

      const movie = await analyzeJob(job.id);
      const updatedJob = await getJobStore().get(job.id);

      expect(movie?.events).toHaveLength(2);
      expect(movie?.frames).toHaveLength(2);
      expect(updatedJob?.status).toBe("succeeded");
      expect(
        calls.some((url) => url.includes("/commits/cccc3333") || url.includes("/commits/dddd4444"))
      ).toBe(false);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
      vi.unstubAllEnvs();
    }
  });

  it("fetches per-commit file details with the server-side GitHub token", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    const authorizationHeaders: Array<string | undefined> = [];

    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      authorizationHeaders.push((init?.headers as Record<string, string> | undefined)?.Authorization);

      if (url.endsWith("/repos/octocat/detail-lab")) {
        return Response.json({
          owner: { login: "octocat" },
          name: "detail-lab",
          full_name: "octocat/detail-lab",
          html_url: "https://github.com/octocat/detail-lab",
          default_branch: "main",
          description: "Detail fixture",
          stargazers_count: 7,
          language: "TypeScript",
          archived: false
        });
      }

      if (url.endsWith("/repos/octocat/detail-lab/branches/main")) {
        return Response.json({ commit: { sha: "detail-latest" } });
      }

      if (url.includes("/repos/octocat/detail-lab/commits?")) {
        return Response.json([
          {
            sha: "aaaa1111",
            commit: {
              message: "Add parser module",
              author: { name: "Ada", date: "2024-02-01T00:00:00Z" }
            },
            author: { login: "ada", avatar_url: "https://example.com/ada.png" }
          },
          {
            sha: "bbbb2222",
            commit: {
              message: "Tune city renderer",
              author: { name: "Lin", date: "2024-02-02T00:00:00Z" }
            },
            author: { login: "lin", avatar_url: "https://example.com/lin.png" }
          }
        ]);
      }

      if (url.endsWith("/repos/octocat/detail-lab/commits/aaaa1111")) {
        return Response.json({
          sha: "aaaa1111",
          commit: {
            message: "Add parser module",
            author: { name: "Ada", date: "2024-02-01T00:00:00Z" }
          },
          author: { login: "ada", avatar_url: "https://example.com/ada.png" },
          files: [
            {
              filename: "src/parser.ts",
              status: "added",
              additions: 120,
              deletions: 0,
              changes: 120
            }
          ]
        });
      }

      if (url.endsWith("/repos/octocat/detail-lab/commits/bbbb2222")) {
        return Response.json({
          sha: "bbbb2222",
          commit: {
            message: "Tune city renderer",
            author: { name: "Lin", date: "2024-02-02T00:00:00Z" }
          },
          author: { login: "lin", avatar_url: "https://example.com/lin.png" },
          files: [
            {
              filename: "src/render/city.ts",
              status: "modified",
              additions: 80,
              deletions: 12,
              changes: 92
            }
          ]
        });
      }

      return new Response("unexpected request", { status: 500 });
    });

    try {
      const job = await getJobStore().create({
        repo: "octocat/detail-lab",
        normalizedRepo: "octocat/detail-lab",
        commitLimit: 30
      });

      const movie = await analyzeJob(job.id);
      const updatedJob = await getJobStore().get(job.id);

      expect(updatedJob?.status).toBe("succeeded");
      expect(movie?.events.map((event) => event.filePath)).toEqual(["src/parser.ts", "src/render/city.ts"]);
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.stringContaining("/repos/octocat/detail-lab/commits/aaaa1111"),
          expect.stringContaining("/repos/octocat/detail-lab/commits/bbbb2222")
        ])
      );
      expect(authorizationHeaders.every((header) => header === "Bearer test-token")).toBe(true);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
      vi.unstubAllEnvs();
    }
  });

  it("reuses a cached movie instead of fetching commit history again", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith("/repos/octocat/cache-lab")) {
        return Response.json({
          owner: { login: "octocat" },
          name: "cache-lab",
          full_name: "octocat/cache-lab",
          html_url: "https://github.com/octocat/cache-lab",
          default_branch: "main",
          description: "Cache fixture",
          stargazers_count: 11,
          language: "TypeScript",
          archived: false
        });
      }

      if (url.endsWith("/repos/octocat/cache-lab/branches/main")) {
        return Response.json({ commit: { sha: "cache-latest" } });
      }

      if (url.includes("/repos/octocat/cache-lab/commits?")) {
        return Response.json([
          {
            sha: "cccc3333",
            commit: {
              message: "Warm cache movie",
              author: { name: "Mina", date: "2024-03-01T00:00:00Z" }
            },
            author: { login: "mina", avatar_url: "https://example.com/mina.png" }
          }
        ]);
      }

      return new Response("unexpected request", { status: 500 });
    });

    try {
      const firstJob = await getJobStore().create({
        repo: "octocat/cache-lab",
        normalizedRepo: "octocat/cache-lab",
        commitLimit: 30
      });
      const firstMovie = await analyzeJob(firstJob.id);

      const secondJob = await getJobStore().create({
        repo: "octocat/cache-lab",
        normalizedRepo: "octocat/cache-lab",
        commitLimit: 30
      });
      const secondMovie = await analyzeJob(secondJob.id);
      const secondUpdatedJob = await getJobStore().get(secondJob.id);

      expect(secondUpdatedJob).toMatchObject({
        status: "succeeded",
        progressStage: "ready",
        progressPercent: 100
      });
      expect(secondMovie).toBe(firstMovie);
      expect(calls.filter((url) => url.includes("/repos/octocat/cache-lab/commits?"))).toHaveLength(1);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
      vi.unstubAllEnvs();
    }
  });

  it("uses full summary history for All without per-commit detail fan-out", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith("/repos/octocat/full-history-lab")) {
        return Response.json({
          owner: { login: "octocat" },
          name: "full-history-lab",
          full_name: "octocat/full-history-lab",
          html_url: "https://github.com/octocat/full-history-lab",
          default_branch: "main",
          description: "Full history fixture",
          stargazers_count: 1234,
          language: "TypeScript",
          archived: false
        });
      }

      if (url.endsWith("/repos/octocat/full-history-lab/branches/main")) {
        return Response.json({ commit: { sha: "full-latest" } });
      }

      if (url.includes("/repos/octocat/full-history-lab/commits?")) {
        const page = Number(new URL(url).searchParams.get("page") ?? "1");
        const count = page === 1 ? 100 : 27;
        return Response.json(
          Array.from({ length: count }, (_, index) => {
            const number = (page - 1) * 100 + index + 1;
            return {
              sha: `full-${number}`,
              commit: {
                message: `Full commit ${number}`,
                author: { name: "Ada", date: `2024-01-${String((number % 28) + 1).padStart(2, "0")}T00:00:00Z` }
              },
              author: { login: "ada", avatar_url: "https://example.com/ada.png" }
            };
          })
        );
      }

      return new Response("unexpected request", { status: 500 });
    });

    try {
      const job = await getJobStore().create({
        repo: "octocat/full-history-lab",
        normalizedRepo: "octocat/full-history-lab",
        commitLimit: ALL_COMMITS_LIMIT
      });

      const movie = await analyzeJob(job.id);
      const updatedJob = await getJobStore().get(job.id);

      expect(updatedJob?.status).toBe("succeeded");
      expect(movie?.commits).toHaveLength(127);
      expect(calls.filter((url) => url.includes("/commits?"))).toHaveLength(2);
      expect(calls.some((url) => /\/commits\/full-\d+/.test(url))).toBe(false);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
      vi.unstubAllEnvs();
    }
  });
});

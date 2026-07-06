import { describe, expect, it } from "vitest";
import commitDetails from "./fixtures/github-commit-details.json";
import { buildMovieCacheKey } from "@/lib/jobs/cache-key";
import { GitHubClient, mapGitHubError } from "@/lib/github/github-client";
import { normalizeGitHubRepoInput } from "@/lib/github/github-url";
import { inferLanguage } from "@/lib/movie/language";
import { buildRepoMovieFromGitHub } from "@/lib/movie/repo-parser";
import { ALL_COMMITS_LIMIT } from "@/lib/security/limits";
import type { GitHubCommitDetail, GitHubRepoMetadata } from "@/lib/github/github-types";

const repo: GitHubRepoMetadata = {
  owner: "octocat",
  name: "Hello-World",
  fullName: "octocat/Hello-World",
  url: "https://github.com/octocat/Hello-World",
  defaultBranch: "main",
  latestSha: "bbbb2222",
  description: "Fixture repository",
  stars: 42,
  primaryLanguage: "TypeScript",
  archived: false
};

describe("normalizeGitHubRepoInput", () => {
  it.each([
    ["https://github.com/octocat/Hello-World", "octocat/Hello-World"],
    ["http://github.com/octocat/Hello-World", "octocat/Hello-World"],
    ["github.com/octocat/Hello-World", "octocat/Hello-World"],
    ["octocat/Hello-World", "octocat/Hello-World"],
    [" https://github.com/octocat/Hello-World.git ", "octocat/Hello-World"]
  ])("normalizes %s", (input, fullName) => {
    expect(normalizeGitHubRepoInput(input).fullName).toBe(fullName);
  });

  it("rejects non-GitHub URLs so the API cannot become a fetch proxy", () => {
    expect(() => normalizeGitHubRepoInput("https://example.com/octocat/Hello-World")).toThrow(
      /Only public GitHub/
    );
  });

  it("rejects invalid owner and repo names", () => {
    expect(() => normalizeGitHubRepoInput("../secret")).toThrow(/Invalid GitHub repository/);
  });
});

describe("inferLanguage", () => {
  it.each([
    ["app/page.tsx", "TypeScript"],
    ["src/render/city.ts", "TypeScript"],
    ["styles/site.css", "CSS"],
    ["README.md", "Markdown"],
    ["Dockerfile", "Docker"],
    ["unknown.weird", "Other"]
  ])("infers %s as %s", (path, language) => {
    expect(inferLanguage(path).name).toBe(language);
  });
});

describe("buildRepoMovieFromGitHub", () => {
  it("creates a durable movie model with lifecycle, events, frames and stats", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[]
    });

    expect(movie.repo.fullName).toBe("octocat/Hello-World");
    expect(movie.commits).toHaveLength(2);
    expect(movie.events).toHaveLength(5);
    expect(movie.frames).toHaveLength(2);
    expect(movie.files["src/render/city.ts"].status).toBe("active");
    expect(movie.files["src/render/city.ts"].language).toBe("TypeScript");
    expect(movie.files["src/render/city.ts"].sizeScore).toBeGreaterThan(0.5);
    expect(movie.files["src/parser.ts"].activityScore).toBeGreaterThan(
      movie.files["package.json"].activityScore
    );
    expect(movie.directories.map((directory) => directory.path)).toContain("src/render");
    expect(movie.stats.totalAdditions).toBe(277);
    expect(movie.stats.primaryLanguages[0].language).toBe("TypeScript");
  });

  it("creates a playable summary movie when commit details do not include file lists", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 60,
      commits: [
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
      ] satisfies GitHubCommitDetail[]
    });

    expect(movie.commits).toHaveLength(2);
    expect(movie.events).toHaveLength(2);
    expect(movie.frames).toHaveLength(2);
    expect(movie.commits[0].changedFiles[0]).toMatchObject({
      path: ".repo/activity/cccc333.ts",
      status: "modified",
      language: "TypeScript"
    });
    expect(movie.frames[0].changedFilePaths).toEqual([".repo/activity/cccc333.ts"]);
    expect(movie.stats.totalFiles).toBe(2);
    expect(movie.stats.totalChanges).toBeGreaterThan(0);
  });
});

describe("buildMovieCacheKey", () => {
  it("is stable and includes repo identity, branch, latest sha and commit limit", () => {
    expect(
      buildMovieCacheKey({
        provider: "github",
        owner: "OctoCat",
        repo: "Hello-World",
        branch: "Main",
        latestSha: "ABCDEF123",
        commitLimit: 60
      })
    ).toBe("github:octocat:hello-world:main:abcdef123:60");
  });
});

describe("mapGitHubError", () => {
  it("fetches summary commits with one list API call", async () => {
    const calls: string[] = [];
    const client = new GitHubClient({
      fetchImpl: async (input) => {
        calls.push(String(input));
        return Response.json([
          {
            sha: "cccc3333",
            commit: {
              message: "Sketch the first city blocks",
              author: { name: "Ada", date: "2024-01-01T00:00:00Z" },
              committer: { name: "Ada", date: "2024-01-01T00:00:00Z" }
            },
            author: {
              login: "ada",
              avatar_url: "https://example.com/ada.png"
            }
          }
        ]);
      }
    });

    const commits = await client.getCommitSummaries("octocat", "Hello-World", "main", 53);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/repos/octocat/Hello-World/commits?sha=main&per_page=53");
    expect(commits[0]).toMatchObject({
      sha: "cccc3333",
      commit: {
        message: "Sketch the first city blocks",
        author: { name: "Ada", date: "2024-01-01T00:00:00Z" }
      },
      author: {
        login: "ada",
        avatar_url: "https://example.com/ada.png"
      }
    });
    expect(commits[0].files).toBeUndefined();
  });

  it("paginates summary commits when the requested limit exceeds GitHub's page size", async () => {
    const calls: string[] = [];
    const client = new GitHubClient({
      fetchImpl: async (input) => {
        calls.push(String(input));
        const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
        const perPage = Number(new URL(String(input)).searchParams.get("per_page") ?? "100");
        return Response.json(
          Array.from({ length: perPage }, (_, index) => {
            const number = (page - 1) * 100 + index + 1;
            return {
              sha: `commit-${number}`,
              commit: {
                message: `Commit ${number}`,
                author: { name: "Ada", date: `2024-01-${String((number % 28) + 1).padStart(2, "0")}T00:00:00Z` }
              },
              author: {
                login: "ada",
                avatar_url: "https://example.com/ada.png"
              }
            };
          })
        );
      }
    });

    const commits = await client.getCommitSummaries("octocat", "Hello-World", "main", 250);

    expect(commits).toHaveLength(250);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("per_page=100");
    expect(calls[0]).toContain("page=1");
    expect(calls[1]).toContain("per_page=100");
    expect(calls[1]).toContain("page=2");
    expect(calls[2]).toContain("per_page=50");
    expect(calls[2]).toContain("page=3");
  });

  it("fetches all summary commit pages when All is requested", async () => {
    const calls: string[] = [];
    const client = new GitHubClient({
      fetchImpl: async (input) => {
        calls.push(String(input));
        const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
        const count = page === 1 ? 100 : 18;
        return Response.json(
          Array.from({ length: count }, (_, index) => {
            const number = (page - 1) * 100 + index + 1;
            return {
              sha: `commit-${number}`,
              commit: {
                message: `Commit ${number}`,
                author: { name: "Ada", date: "2024-01-01T00:00:00Z" }
              },
              author: {
                login: "ada",
                avatar_url: "https://example.com/ada.png"
              }
            };
          })
        );
      }
    });

    const commits = await client.getCommitSummaries("octocat", "Hello-World", "main", ALL_COMMITS_LIMIT);

    expect(commits).toHaveLength(118);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("per_page=100");
    expect(calls[1]).toContain("per_page=100");
    expect(calls[1]).toContain("page=2");
  });

  it("maps rate-limit responses to a retryable user-facing error", () => {
    const mapped = mapGitHubError(
      new Response("rate limited", {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0"
        }
      })
    );

    expect(mapped).toMatchObject({
      code: "github_rate_limited",
      retryable: true
    });
  });

  it("maps missing repositories to a clear non-retryable error", () => {
    expect(mapGitHubError(new Response("missing", { status: 404 }))).toMatchObject({
      code: "repo_not_found",
      retryable: false
    });
  });

  it("maps thrown fetch failures to a retryable GitHub network error", async () => {
    const client = new GitHubClient({
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      }
    });

    await expect(client.getRepository("octocat", "Hello-World")).rejects.toMatchObject({
      details: {
        code: "github_network_error",
        retryable: true
      }
    });
  });
});

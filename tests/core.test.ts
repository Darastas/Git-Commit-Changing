import { describe, expect, it } from "vitest";
import commitDetails from "./fixtures/github-commit-details.json";
import { buildMovieCacheKey } from "@/lib/jobs/cache-key";
import { GitHubClient, mapGitHubError } from "@/lib/github/github-client";
import { normalizeGitHubRepoInput } from "@/lib/github/github-url";
import { inferLanguage } from "@/lib/movie/language";
import { buildRepoMovieFromGitHub } from "@/lib/movie/repo-parser";
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

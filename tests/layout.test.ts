import { describe, expect, it } from "vitest";
import { buildCodeCityLayout } from "@/lib/movie/layout";
import { buildRepoMovieFromGitHub } from "@/lib/movie/repo-parser";
import type { GitHubCommitDetail, GitHubRepoMetadata } from "@/lib/github/github-types";
import commitDetails from "./fixtures/github-commit-details.json";

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

describe("buildCodeCityLayout", () => {
  it("groups active files into directory districts with stable building rectangles", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[]
    });

    const layout = buildCodeCityLayout(movie, 1000, 600);

    expect(layout.districts.map((district) => district.path)).toContain("src");
    expect(layout.districts.map((district) => district.path)).toContain("src/render");
    expect(layout.buildings.map((building) => building.path)).toContain("src/parser.ts");
    expect(layout.buildings.every((building) => building.width >= 16)).toBe(true);
    expect(layout.buildings.every((building) => building.height >= 24)).toBe(true);
    expect(layout.buildings.find((building) => building.path === "src/render/city.ts")?.height).toBeGreaterThan(
      layout.buildings.find((building) => building.path === "README.md")?.height ?? 0
    );
  });
});

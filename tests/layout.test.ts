import { describe, expect, it } from "vitest";
import type { GitHubCommitDetail, GitHubRepoMetadata } from "@/lib/github/github-types";
import { buildRepoMovieFromGitHub } from "@/lib/movie/repo-parser";
import { advanceTrendProgress, buildCommitTrend, interpolateTrendPoint, nearestTrendPoint } from "@/lib/movie/trend";
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

describe("buildCommitTrend", () => {
  it("sorts commits by authored date and assigns cumulative counts", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[]
    });

    const trend = buildCommitTrend(movie);

    expect(trend.map((point) => point.commitSha)).toEqual(["aaaa1111", "bbbb2222"]);
    expect(trend.map((point) => point.cumulativeCommits)).toEqual([1, 2]);
    expect(trend[1].changedFiles.map((file) => file.path)).toContain("src/render/city.ts");
  });

  it("interpolates between commit points instead of snapping to a frame", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[]
    });

    const trend = buildCommitTrend(movie);
    const interpolated = interpolateTrendPoint(trend, 0.5);

    expect(interpolated?.left.commitSha).toBe("aaaa1111");
    expect(interpolated?.right.commitSha).toBe("bbbb2222");
    expect(interpolated?.segmentProgress).toBeCloseTo(0.5);
    expect(interpolated?.cumulativeCommits).toBeCloseTo(1.5);
    expect(interpolated?.timestamp).toBeGreaterThan(trend[0].timestamp);
    expect(interpolated?.timestamp).toBeLessThan(trend[1].timestamp);
  });

  it("selects the nearest real commit for metadata display", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[]
    });

    const trend = buildCommitTrend(movie);

    expect(nearestTrendPoint(trend, 0.1)?.commitSha).toBe("aaaa1111");
    expect(nearestTrendPoint(trend, 0.9)?.commitSha).toBe("bbbb2222");
  });

  it("maps the repository star total onto the commit timeline", () => {
    const movie = buildRepoMovieFromGitHub({
      repo,
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[]
    });

    const trend = buildCommitTrend(movie);

    expect(trend[0].cumulativeStars).toBeGreaterThan(0);
    expect(trend[0].cumulativeStars).toBeLessThanOrEqual(21);
    expect(trend[1].cumulativeStars).toBeGreaterThanOrEqual(trend[0].cumulativeStars);
    expect(trend.at(-1)?.cumulativeStars).toBe(movie.repo.stars);
  });

  it("advances playback progress continuously without frame-boundary jumps", () => {
    const beforeBoundary = advanceTrendProgress({
      currentProgress: 0.249,
      deltaMs: 16,
      speed: 1,
      playing: true,
      durationMs: 4800
    });
    const afterBoundary = advanceTrendProgress({
      currentProgress: beforeBoundary,
      deltaMs: 16,
      speed: 1,
      playing: true,
      durationMs: 4800
    });

    expect(afterBoundary).toBeGreaterThan(beforeBoundary);
    expect(afterBoundary - beforeBoundary).toBeLessThan(0.01);
  });
});

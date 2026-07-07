import { describe, expect, it } from "vitest";
import type { GitHubCommitDetail, GitHubRepoMetadata } from "@/lib/github/github-types";
import { buildRepoMovieFromGitHub } from "@/lib/movie/repo-parser";
import {
  advanceTrendProgress,
  buildCommitTrend,
  buildDynamicTrendScales,
  interpolateTrendPoint,
  nearestTrendPoint
} from "@/lib/movie/trend";
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

  it("uses fetched GitHub star history at each commit date when it is available", () => {
    const movie = buildRepoMovieFromGitHub({
      repo: { ...repo, stars: 100 },
      commitLimit: 30,
      commits: commitDetails as GitHubCommitDetail[],
      starHistory: {
        source: "github-stargazers",
        complete: true,
        points: [
          { starredAt: "2024-02-29T00:00:00Z", cumulativeStars: 2 },
          { starredAt: "2024-03-01T12:00:00Z", cumulativeStars: 5 },
          { starredAt: "2024-03-02T09:00:00Z", cumulativeStars: 9 },
          { starredAt: "2024-03-03T00:00:00Z", cumulativeStars: 100 }
        ]
      }
    });

    const trend = buildCommitTrend(movie);

    expect(trend.map((point) => point.cumulativeStars)).toEqual([2, 9]);
    expect(trend.at(-1)?.cumulativeStars).not.toBe(movie.repo.stars);
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

  it("can clamp playback at the end for finite recording exports", () => {
    const progress = advanceTrendProgress({
      currentProgress: 0.99,
      deltaMs: 1000,
      speed: 1,
      playing: true,
      durationMs: 1000,
      loop: false
    });

    expect(progress).toBe(1);
  });

  it("stops normal playback at the final frame instead of looping", () => {
    const progress = advanceTrendProgress({
      currentProgress: 0.99,
      deltaMs: 1000,
      speed: 1,
      playing: true,
      durationMs: 1000
    });

    expect(progress).toBe(1);
  });

  it("expands chart scales as the playback reaches larger history totals", () => {
    const movie = buildRepoMovieFromGitHub({
      repo: { ...repo, stars: 5000 },
      commitLimit: 30,
      commits: Array.from({ length: 40 }, (_, index) => ({
        sha: `scale-${index}`,
        commit: {
          message: `Scale commit ${index}`,
          author: { name: "Ada", date: `2024-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z` }
        },
        author: { login: "ada", avatar_url: "https://example.com/ada.png" }
      }))
    });

    const trend = buildCommitTrend(movie);
    const early = buildDynamicTrendScales(trend, 0.02);
    const late = buildDynamicTrendScales(trend, 0.8);
    const final = buildDynamicTrendScales(trend, 1);

    expect(early.commitMax).toBeLessThan(late.commitMax);
    expect(early.starMax).toBeLessThan(late.starMax);
    expect(early.timeEnd - early.timeStart).toBeLessThan(late.timeEnd - late.timeStart);
    expect(late.finalCommitMax).toBe(40);
    expect(late.finalStarMax).toBe(5000);
    expect(final.commitMax).toBe(final.finalCommitMax);
    expect(final.starMax).toBe(final.finalStarMax);
    expect(final.timeStart).toBe(final.finalTimeStart);
    expect(final.timeEnd).toBe(final.finalTimeEnd);
  });
});

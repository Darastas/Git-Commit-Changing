import type { MovieCommit, RepoMovie } from "./repo-movie-types";

export type CommitTrendPoint = {
  commitSha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorLogin?: string;
  authorAvatar?: string;
  date: string;
  timestamp: number;
  cumulativeCommits: number;
  additions: number;
  deletions: number;
  changedFiles: MovieCommit["changedFiles"];
};

export type InterpolatedTrendPoint = {
  progress: number;
  segmentIndex: number;
  segmentProgress: number;
  left: CommitTrendPoint;
  right: CommitTrendPoint;
  timestamp: number;
  cumulativeCommits: number;
};

function toTimestamp(date: string, fallback: number) {
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export function buildCommitTrend(movie: RepoMovie): CommitTrendPoint[] {
  return movie.commits
    .map((commit, originalIndex) => ({
      commit,
      originalIndex,
      timestamp: toTimestamp(commit.date, originalIndex)
    }))
    .sort((a, b) => a.timestamp - b.timestamp || a.originalIndex - b.originalIndex)
    .map(({ commit, timestamp }, index) => ({
      commitSha: commit.sha,
      shortSha: commit.shortSha,
      message: commit.message,
      authorName: commit.authorName,
      authorLogin: commit.authorLogin,
      authorAvatar: commit.authorAvatar,
      date: commit.date,
      timestamp,
      cumulativeCommits: index + 1,
      additions: commit.additions,
      deletions: commit.deletions,
      changedFiles: commit.changedFiles
    }));
}

export function interpolateTrendPoint(points: CommitTrendPoint[], progress: number): InterpolatedTrendPoint | undefined {
  if (points.length === 0) {
    return undefined;
  }

  if (points.length === 1) {
    return {
      progress: 1,
      segmentIndex: 0,
      segmentProgress: 0,
      left: points[0],
      right: points[0],
      timestamp: points[0].timestamp,
      cumulativeCommits: points[0].cumulativeCommits
    };
  }

  const normalizedProgress = clamp(progress, 0, 1);
  const scaledProgress = normalizedProgress * (points.length - 1);
  const segmentIndex = Math.min(points.length - 2, Math.floor(scaledProgress));
  const segmentProgress = scaledProgress - segmentIndex;
  const left = points[segmentIndex];
  const right = points[segmentIndex + 1];

  return {
    progress: normalizedProgress,
    segmentIndex,
    segmentProgress,
    left,
    right,
    timestamp: lerp(left.timestamp, right.timestamp, segmentProgress),
    cumulativeCommits: lerp(left.cumulativeCommits, right.cumulativeCommits, segmentProgress)
  };
}

export function nearestTrendPoint(points: CommitTrendPoint[], progress: number): CommitTrendPoint | undefined {
  if (points.length === 0) {
    return undefined;
  }

  if (points.length === 1) {
    return points[0];
  }

  const normalizedProgress = clamp(progress, 0, 1);
  const index = Math.min(points.length - 1, Math.max(0, Math.round(normalizedProgress * (points.length - 1))));
  return points[index];
}

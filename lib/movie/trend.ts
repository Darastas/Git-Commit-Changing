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
  cumulativeStars: number;
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
  cumulativeStars: number;
};

export type ContinuousProgressInput = {
  currentProgress: number;
  deltaMs: number;
  speed: number;
  playing: boolean;
  durationMs: number;
  loop?: boolean;
};

export type DynamicTrendScales = {
  commitMax: number;
  starMax: number;
  finalCommitMax: number;
  finalStarMax: number;
  timeStart: number;
  timeEnd: number;
  finalTimeStart: number;
  finalTimeEnd: number;
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

function dynamicAxisMax(activeValue: number, finalMax: number, padding: number, minimumVisible: number) {
  if (finalMax <= 0) {
    return 0;
  }

  const paddedActiveValue = Math.max(minimumVisible, activeValue * padding);
  return Math.min(finalMax, paddedActiveValue);
}

function dynamicTimeEnd(timeStart: number, finalTimeEnd: number, activeTimestamp: number) {
  const finalSpan = Math.max(0, finalTimeEnd - timeStart);
  if (finalSpan <= 0) {
    return finalTimeEnd;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  const activeSpan = Math.max(0, activeTimestamp - timeStart);
  const minimumVisibleSpan = Math.min(finalSpan, Math.max(oneDayMs, finalSpan * 0.04));
  const visibleSpan = Math.min(finalSpan, Math.max(minimumVisibleSpan, activeSpan * 1.22));
  return timeStart + visibleSpan;
}

function starHistoryPoints(movie: RepoMovie) {
  return (movie.repo.starHistory?.points ?? [])
    .map((point) => ({
      timestamp: toTimestamp(point.starredAt, Number.NaN),
      cumulativeStars: Math.max(0, point.cumulativeStars)
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp || a.cumulativeStars - b.cumulativeStars);
}

function historicalStarsAt(
  timestamp: number,
  points: ReturnType<typeof starHistoryPoints>,
  complete: boolean
) {
  if (points.length === 0) {
    return undefined;
  }

  if (timestamp < points[0].timestamp) {
    return complete ? 0 : points[0].cumulativeStars;
  }

  let left = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    if (right.timestamp > timestamp) {
      if (complete) {
        return left.cumulativeStars;
      }

      const span = Math.max(1, right.timestamp - left.timestamp);
      return Math.round(lerp(left.cumulativeStars, right.cumulativeStars, (timestamp - left.timestamp) / span));
    }
    left = right;
  }

  return left.cumulativeStars;
}

export function buildCommitTrend(movie: RepoMovie): CommitTrendPoint[] {
  const totalStars = Math.max(0, movie.repo.stars ?? 0);
  const historyPoints = starHistoryPoints(movie);
  const hasStarHistory = historyPoints.length > 0;
  const completeStarHistory = movie.repo.starHistory?.complete ?? false;
  const ordered = movie.commits
    .map((commit, originalIndex) => ({
      commit,
      originalIndex,
      timestamp: toTimestamp(commit.date, originalIndex)
    }))
    .sort((a, b) => a.timestamp - b.timestamp || a.originalIndex - b.originalIndex);
  const pointCount = Math.max(1, ordered.length);

  return ordered.map(({ commit, timestamp }, index) => ({
      commitSha: commit.sha,
      shortSha: commit.shortSha,
      message: commit.message,
      authorName: commit.authorName,
      authorLogin: commit.authorLogin,
      authorAvatar: commit.authorAvatar,
      date: commit.date,
      timestamp,
      cumulativeCommits: index + 1,
      cumulativeStars:
        hasStarHistory
          ? historicalStarsAt(timestamp, historyPoints, completeStarHistory) ?? 0
          : index === pointCount - 1
            ? totalStars
            : Math.round(totalStars * Math.pow((index + 1) / pointCount, 1.22)),
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
      cumulativeCommits: points[0].cumulativeCommits,
      cumulativeStars: points[0].cumulativeStars
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
    cumulativeCommits: lerp(left.cumulativeCommits, right.cumulativeCommits, segmentProgress),
    cumulativeStars: lerp(left.cumulativeStars, right.cumulativeStars, segmentProgress)
  };
}

export function advanceTrendProgress({
  currentProgress,
  deltaMs,
  speed,
  playing,
  durationMs,
  loop
}: ContinuousProgressInput): number {
  const normalized = clamp(currentProgress, 0, 1);
  if (!playing) {
    return normalized;
  }

  const safeDuration = Math.max(1, durationMs);
  const delta = Math.max(0, deltaMs) * Math.max(0, speed) / safeDuration;
  if (delta === 0) {
    return normalized;
  }

  const next = normalized + delta;
  if (next >= 1) {
    return loop === false ? 1 : next % 1;
  }
  return next;
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

export function buildDynamicTrendScales(points: CommitTrendPoint[], progress: number): DynamicTrendScales {
  const finalCommitMax = Math.max(1, points.length);
  const finalStarMax = Math.max(0, points[points.length - 1]?.cumulativeStars ?? 0);
  const finalTimeStart = points[0]?.timestamp ?? 0;
  const finalTimeEnd = points[points.length - 1]?.timestamp ?? finalTimeStart;
  const interpolated = interpolateTrendPoint(points, progress);
  const activeCommits = interpolated?.cumulativeCommits ?? finalCommitMax;
  const activeStars = interpolated?.cumulativeStars ?? finalStarMax;
  const activeTimestamp = interpolated?.timestamp ?? finalTimeEnd;

  const commitMax = dynamicAxisMax(activeCommits, finalCommitMax, 1.32, 4);
  const starMax = dynamicAxisMax(activeStars, finalStarMax, 1.38, 4);
  const timeEnd = dynamicTimeEnd(finalTimeStart, finalTimeEnd, activeTimestamp);

  return {
    commitMax: Math.max(1, commitMax),
    starMax: Math.max(0, starMax),
    finalCommitMax,
    finalStarMax,
    timeStart: finalTimeStart,
    timeEnd,
    finalTimeStart,
    finalTimeEnd
  };
}

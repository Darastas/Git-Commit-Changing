import type { GitHubFileStatus } from "@/lib/github/github-types";

export type MovieFileStatus = "active" | "deleted";

export type MovieCommitFile = {
  path: string;
  previousPath?: string;
  status: GitHubFileStatus | string;
  additions: number;
  deletions: number;
  changes: number;
  language: string;
};

export type MovieCommit = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorAvatar?: string;
  date: string;
  changedFiles: MovieCommitFile[];
  additions: number;
  deletions: number;
};

export type MovieFile = {
  path: string;
  name: string;
  directory: string;
  language: string;
  color: string;
  status: MovieFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  sizeScore: number;
  activityScore: number;
  createdAt: string;
  createdAtCommitSha: string;
  deletedAt?: string;
  deletedAtCommitSha?: string;
  lastTouchedAt: string;
};

export type MovieDirectory = {
  path: string;
  name: string;
  fileCount: number;
  activeFileCount: number;
  totalChanges: number;
  languages: string[];
};

export type MovieChangeEvent = {
  id: string;
  commitSha: string;
  filePath: string;
  previousPath?: string;
  status: GitHubFileStatus | string;
  language: string;
  additions: number;
  deletions: number;
  changes: number;
  date: string;
};

export type MovieFrameFile = {
  path: string;
  status: MovieFileStatus;
  sizeScore: number;
  activityScore: number;
  recentChange: boolean;
};

export type MovieFrame = {
  index: number;
  commitSha: string;
  date: string;
  activeFileCount: number;
  totalFiles: number;
  changedFilePaths: string[];
  additions: number;
  deletions: number;
  intensity: number;
  files: Record<string, MovieFrameFile>;
};

export type MovieStats = {
  totalCommits: number;
  totalFiles: number;
  activeFiles: number;
  deletedFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  totalChanges: number;
  largestCommit: {
    sha: string;
    message: string;
    changes: number;
  };
  primaryLanguages: Array<{
    language: string;
    files: number;
    changes: number;
    color: string;
  }>;
};

export type RepoMovie = {
  version: string;
  repo: {
    provider: "github";
    owner: string;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
    latestSha: string;
    description?: string;
    stars?: number;
    primaryLanguage?: string;
  };
  generatedAt: string;
  commitLimit: number;
  commits: MovieCommit[];
  files: Record<string, MovieFile>;
  directories: MovieDirectory[];
  events: MovieChangeEvent[];
  frames: MovieFrame[];
  stats: MovieStats;
};

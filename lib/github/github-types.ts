export type GitHubFileStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "changed"
  | "unchanged";

export type GitHubRepoMetadata = {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  latestSha: string;
  description?: string;
  stars?: number;
  primaryLanguage?: string;
  archived: boolean;
};

export type GitHubStarHistoryPoint = {
  starredAt: string;
  cumulativeStars: number;
};

export type GitHubStarHistory = {
  source: "github-stargazers";
  complete: boolean;
  points: GitHubStarHistoryPoint[];
};

export type GitHubCommitAuthor = {
  name?: string;
  date?: string;
};

export type GitHubChangedFile = {
  filename: string;
  previous_filename?: string;
  status: GitHubFileStatus | string;
  additions: number;
  deletions: number;
  changes: number;
};

export type GitHubCommitDetail = {
  sha: string;
  commit: {
    message: string;
    author?: GitHubCommitAuthor | null;
    committer?: GitHubCommitAuthor | null;
  };
  author?: {
    login?: string;
    avatar_url?: string;
  } | null;
  files?: GitHubChangedFile[];
};

export type GitHubRepoInput = {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
};

export type GitHubApiError = {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
};

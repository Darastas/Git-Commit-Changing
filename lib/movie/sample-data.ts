import type { GitHubCommitDetail, GitHubRepoMetadata } from "@/lib/github/github-types";
import { buildRepoMovieFromGitHub } from "./repo-parser";

const sampleRepo: GitHubRepoMetadata = {
  owner: "demo",
  name: "signal-studio",
  fullName: "demo/signal-studio",
  url: "https://github.com/demo/signal-studio",
  defaultBranch: "main",
  latestSha: "sample004",
  description: "A sample repository movie used when no GitHub repo is loaded.",
  stars: 128,
  primaryLanguage: "TypeScript",
  archived: false
};

const sampleCommits: GitHubCommitDetail[] = [
  {
    sha: "sample001",
    commit: {
      message: "Bootstrap interface shell",
      author: { name: "Mina", date: "2024-01-02T10:00:00Z" }
    },
    author: { login: "mina", avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4" },
    files: [
      { filename: "app/page.tsx", status: "added", additions: 86, deletions: 0, changes: 86 },
      { filename: "components/Toolbar.tsx", status: "added", additions: 42, deletions: 0, changes: 42 },
      { filename: "README.md", status: "added", additions: 28, deletions: 0, changes: 28 }
    ]
  },
  {
    sha: "sample002",
    commit: {
      message: "Add parser pipeline",
      author: { name: "Ari", date: "2024-01-06T14:30:00Z" }
    },
    author: { login: "ari", avatar_url: "https://avatars.githubusercontent.com/u/69631?v=4" },
    files: [
      { filename: "lib/parser/github.ts", status: "added", additions: 144, deletions: 0, changes: 144 },
      { filename: "lib/parser/languages.ts", status: "added", additions: 64, deletions: 0, changes: 64 },
      { filename: "app/page.tsx", status: "modified", additions: 34, deletions: 12, changes: 46 }
    ]
  },
  {
    sha: "sample003",
    commit: {
      message: "Render code city timeline",
      author: { name: "Noor", date: "2024-01-09T09:15:00Z" }
    },
    author: { login: "noor", avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4" },
    files: [
      { filename: "components/CodeCityCanvas.tsx", status: "added", additions: 176, deletions: 0, changes: 176 },
      { filename: "components/MoviePlayer.tsx", status: "added", additions: 132, deletions: 0, changes: 132 },
      { filename: "lib/parser/github.ts", status: "modified", additions: 22, deletions: 9, changes: 31 }
    ]
  },
  {
    sha: "sample004",
    commit: {
      message: "Polish export and sharing controls",
      author: { name: "Mina", date: "2024-01-12T16:40:00Z" }
    },
    author: { login: "mina", avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4" },
    files: [
      { filename: "components/ExportMenu.tsx", status: "added", additions: 58, deletions: 0, changes: 58 },
      { filename: "components/MoviePlayer.tsx", status: "modified", additions: 48, deletions: 16, changes: 64 },
      { filename: "components/Toolbar.tsx", status: "removed", additions: 0, deletions: 42, changes: 42 }
    ]
  }
];

export const sampleMovie = buildRepoMovieFromGitHub({
  repo: sampleRepo,
  commits: sampleCommits,
  commitLimit: 30
});

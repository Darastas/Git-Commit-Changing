import type {
  GitHubChangedFile,
  GitHubCommitDetail,
  GitHubRepoMetadata,
  GitHubStarHistory
} from "@/lib/github/github-types";
import { inferLanguage } from "./language";
import type {
  MovieChangeEvent,
  MovieCommit,
  MovieDirectory,
  MovieFile,
  MovieFrame,
  MovieStats,
  RepoMovie
} from "./repo-movie-types";

type BuildRepoMovieInput = {
  repo: GitHubRepoMetadata;
  commits: GitHubCommitDetail[];
  commitLimit: number;
  starHistory?: GitHubStarHistory;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeScore(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }
  return clamp01(Math.log10(value + 1) / Math.log10(max + 1));
}

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

function directoryName(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

const summaryLanguageExtensions: Record<string, string> = {
  TypeScript: "ts",
  JavaScript: "js",
  Python: "py",
  Go: "go",
  Rust: "rs",
  Java: "java",
  Kotlin: "kt",
  Swift: "swift",
  PHP: "php",
  Ruby: "rb",
  HTML: "html",
  CSS: "css",
  SCSS: "scss",
  Vue: "vue",
  Svelte: "svelte",
  Markdown: "md",
  JSON: "json",
  YAML: "yml",
  Shell: "sh",
  Docker: "Dockerfile"
};

function summaryActivityPath(commit: GitHubCommitDetail, primaryLanguage?: string) {
  const shortSha = commit.sha.slice(0, 7) || "commit";
  const extension = primaryLanguage ? summaryLanguageExtensions[primaryLanguage] : undefined;

  if (extension === "Dockerfile") {
    return `.repo/activity/${shortSha}.Dockerfile`;
  }

  return `.repo/activity/${shortSha}.${extension ?? "commit"}`;
}

function summaryChangedFiles(commit: GitHubCommitDetail, primaryLanguage?: string): GitHubChangedFile[] {
  const messageLength = commit.commit.message.trim().length;
  const changes = Math.max(1, Math.min(8, Math.ceil(messageLength / 24)));

  return [
    {
      filename: summaryActivityPath(commit, primaryLanguage),
      status: "modified",
      additions: changes,
      deletions: 0,
      changes
    }
  ];
}

function commitDate(commit: GitHubCommitDetail) {
  return (
    commit.commit.author?.date ??
    commit.commit.committer?.date ??
    new Date(0).toISOString()
  );
}

function toMovieCommit(commit: GitHubCommitDetail, primaryLanguage?: string): MovieCommit {
  const sourceFiles =
    commit.files && commit.files.length > 0
      ? commit.files
      : summaryChangedFiles(commit, primaryLanguage);

  const changedFiles = sourceFiles.map((file) => {
    const language = inferLanguage(file.filename);
    return {
      path: file.filename,
      previousPath: file.previous_filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      language: language.name
    };
  });

  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    message: commit.commit.message.split("\n")[0] || "(no commit message)",
    authorName: commit.commit.author?.name ?? commit.author?.login ?? "Unknown author",
    authorLogin: commit.author?.login,
    authorAvatar: commit.author?.avatar_url,
    date: commitDate(commit),
    changedFiles,
    additions: changedFiles.reduce((sum, file) => sum + file.additions, 0),
    deletions: changedFiles.reduce((sum, file) => sum + file.deletions, 0)
  };
}

function buildDirectories(files: Record<string, MovieFile>): MovieDirectory[] {
  const directoryMap = new Map<string, MovieDirectory>();

  for (const file of Object.values(files)) {
    const directory = directoryMap.get(file.directory) ?? {
      path: file.directory,
      name: file.directory === "." ? "root" : file.directory.split("/").pop() ?? file.directory,
      fileCount: 0,
      activeFileCount: 0,
      totalChanges: 0,
      languages: []
    };

    directory.fileCount += 1;
    directory.activeFileCount += file.status === "active" ? 1 : 0;
    directory.totalChanges += file.changes;
    directory.languages = Array.from(new Set([...directory.languages, file.language])).sort();
    directoryMap.set(file.directory, directory);
  }

  return Array.from(directoryMap.values()).sort((a, b) => {
    if (a.path === ".") {
      return -1;
    }
    if (b.path === ".") {
      return 1;
    }
    return a.path.localeCompare(b.path);
  });
}

function buildStats(commits: MovieCommit[], files: Record<string, MovieFile>): MovieStats {
  const fileList = Object.values(files);
  const totalAdditions = commits.reduce((sum, commit) => sum + commit.additions, 0);
  const totalDeletions = commits.reduce((sum, commit) => sum + commit.deletions, 0);
  const largestCommit = commits.reduce(
    (largest, commit) => {
      const changes = commit.additions + commit.deletions;
      return changes > largest.changes
        ? { sha: commit.sha, message: commit.message, changes }
        : largest;
    },
    { sha: "", message: "", changes: 0 }
  );

  const languageMap = new Map<string, { language: string; files: number; changes: number; color: string }>();
  for (const file of fileList) {
    const language = languageMap.get(file.language) ?? {
      language: file.language,
      files: 0,
      changes: 0,
      color: file.color
    };
    language.files += 1;
    language.changes += file.changes;
    languageMap.set(file.language, language);
  }

  return {
    totalCommits: commits.length,
    totalFiles: fileList.length,
    activeFiles: fileList.filter((file) => file.status === "active").length,
    deletedFiles: fileList.filter((file) => file.status === "deleted").length,
    totalAdditions,
    totalDeletions,
    totalChanges: totalAdditions + totalDeletions,
    largestCommit,
    primaryLanguages: Array.from(languageMap.values()).sort(
      (a, b) => b.changes - a.changes || b.files - a.files || a.language.localeCompare(b.language)
    )
  };
}

export function buildRepoMovieFromGitHub(input: BuildRepoMovieInput): RepoMovie {
  const chronologicalCommits = [...input.commits].sort(
    (a, b) => new Date(commitDate(a)).getTime() - new Date(commitDate(b)).getTime()
  );
  const movieCommits = chronologicalCommits.map((commit) =>
    toMovieCommit(commit, input.repo.primaryLanguage)
  );
  const files: Record<string, MovieFile> = {};
  const events: MovieChangeEvent[] = [];
  const frames: MovieFrame[] = [];
  const maxCommitChanges = Math.max(
    1,
    ...movieCommits.map((commit) => commit.additions + commit.deletions)
  );

  for (const [index, commit] of movieCommits.entries()) {
    for (const changedFile of commit.changedFiles) {
      if (changedFile.status === "renamed" && changedFile.previousPath && files[changedFile.previousPath]) {
        files[changedFile.path] = {
          ...files[changedFile.previousPath],
          path: changedFile.path,
          name: fileName(changedFile.path),
          directory: directoryName(changedFile.path)
        };
        delete files[changedFile.previousPath];
      }

      const language = inferLanguage(changedFile.path);
      const existing = files[changedFile.path];
      const additions = (existing?.additions ?? 0) + changedFile.additions;
      const deletions = (existing?.deletions ?? 0) + changedFile.deletions;
      const changes = (existing?.changes ?? 0) + changedFile.changes;
      const status = changedFile.status === "removed" ? "deleted" : "active";

      files[changedFile.path] = {
        path: changedFile.path,
        name: fileName(changedFile.path),
        directory: directoryName(changedFile.path),
        language: language.name,
        color: language.color,
        status,
        additions,
        deletions,
        changes,
        sizeScore: 0,
        activityScore: 0,
        createdAt: existing?.createdAt ?? commit.date,
        createdAtCommitSha: existing?.createdAtCommitSha ?? commit.sha,
        deletedAt: status === "deleted" ? commit.date : undefined,
        deletedAtCommitSha: status === "deleted" ? commit.sha : undefined,
        lastTouchedAt: commit.date
      };

      events.push({
        id: `${commit.sha}:${changedFile.path}`,
        commitSha: commit.sha,
        filePath: changedFile.path,
        previousPath: changedFile.previousPath,
        status: changedFile.status,
        language: language.name,
        additions: changedFile.additions,
        deletions: changedFile.deletions,
        changes: changedFile.changes,
        date: commit.date
      });
    }

    const currentMaxChanges = Math.max(1, ...Object.values(files).map((file) => file.changes));
    for (const file of Object.values(files)) {
      file.sizeScore = normalizeScore(Math.max(0, file.additions - file.deletions), currentMaxChanges);
      file.activityScore = normalizeScore(file.changes, currentMaxChanges);
    }

    const changedFilePaths = commit.changedFiles.map((file) => file.path);
    frames.push({
      index,
      commitSha: commit.sha,
      date: commit.date,
      activeFileCount: Object.values(files).filter((file) => file.status === "active").length,
      totalFiles: Object.keys(files).length,
      changedFilePaths,
      additions: commit.additions,
      deletions: commit.deletions,
      intensity: clamp01((commit.additions + commit.deletions) / maxCommitChanges),
      files: Object.fromEntries(
        Object.values(files).map((file) => [
          file.path,
          {
            path: file.path,
            status: file.status,
            sizeScore: file.sizeScore,
            activityScore: file.activityScore,
            recentChange: changedFilePaths.includes(file.path)
          }
        ])
      )
    });
  }

  const finalMaxChanges = Math.max(1, ...Object.values(files).map((file) => file.changes));
  for (const file of Object.values(files)) {
    file.sizeScore = normalizeScore(Math.max(0, file.additions - file.deletions), finalMaxChanges);
    file.activityScore = normalizeScore(file.changes, finalMaxChanges);
  }

  return {
    version: "1.0",
    repo: {
      provider: "github",
      owner: input.repo.owner,
      name: input.repo.name,
      fullName: input.repo.fullName,
      url: input.repo.url,
      defaultBranch: input.repo.defaultBranch,
      latestSha: input.repo.latestSha,
      description: input.repo.description,
      stars: input.repo.stars,
      starHistory: input.starHistory,
      primaryLanguage: input.repo.primaryLanguage
    },
    generatedAt: new Date().toISOString(),
    commitLimit: input.commitLimit,
    commits: movieCommits,
    files,
    directories: buildDirectories(files),
    events,
    frames,
    stats: buildStats(movieCommits, files)
  };
}

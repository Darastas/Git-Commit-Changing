import type { GitHubRepoInput } from "./github-types";

const OWNER_REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;

function stripSuffix(value: string) {
  return value
    .trim()
    .replace(/[#?].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
}

export function normalizeGitHubRepoInput(input: string): GitHubRepoInput {
  const trimmed = stripSuffix(input);

  if (!trimmed) {
    throw new Error("Enter a public GitHub repository such as owner/repo.");
  }

  let path = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() !== "github.com") {
      throw new Error("Only public GitHub repository URLs are supported.");
    }
    path = url.pathname.replace(/^\/+/, "");
  } else if (/^github\.com\//i.test(trimmed)) {
    path = trimmed.replace(/^github\.com\//i, "");
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new Error("Only public GitHub repository URLs are supported.");
  }

  path = stripSuffix(path);
  const parts = path.split("/");

  if (parts.length !== 2 || !OWNER_REPO_PATTERN.test(path)) {
    throw new Error("Invalid GitHub repository. Use owner/repo or github.com/owner/repo.");
  }

  const [owner, repo] = parts;
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`
  };
}

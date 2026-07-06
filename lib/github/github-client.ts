import type {
  GitHubApiError,
  GitHubCommitDetail,
  GitHubRepoMetadata
} from "./github-types";

type GitHubClientOptions = {
  token?: string;
  fetchImpl?: typeof fetch;
};

type GitHubRepoResponse = {
  owner: { login: string };
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  description?: string | null;
  stargazers_count?: number;
  language?: string | null;
  archived?: boolean;
};

type GitHubCommitListResponse = Array<{
  sha: string;
  commit?: {
    message?: string;
    author?: GitHubCommitDetail["commit"]["author"];
    committer?: GitHubCommitDetail["commit"]["committer"];
  };
  author?: {
    login?: string;
    avatar_url?: string;
  } | null;
}>;

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_MAX_PAGE_SIZE = 100;

export class GitHubClientError extends Error {
  readonly details: GitHubApiError;

  constructor(details: GitHubApiError) {
    super(details.message);
    this.name = "GitHubClientError";
    this.details = details;
  }
}

export function mapGitHubError(response: Response): GitHubApiError {
  const status = response.status;
  const remaining = response.headers.get("x-ratelimit-remaining");

  if ((status === 403 || status === 429) && remaining === "0") {
    return {
      code: "github_rate_limited",
      message: "GitHub API rate limit reached. Add GITHUB_TOKEN or try again later.",
      retryable: true,
      status
    };
  }

  if (status === 404) {
    return {
      code: "repo_not_found",
      message: "Repository not found, private, or unavailable to the GitHub API.",
      retryable: false,
      status
    };
  }

  if (status === 409) {
    return {
      code: "repo_empty",
      message: "Repository exists but has no commits to analyze.",
      retryable: false,
      status
    };
  }

  if (status >= 500) {
    return {
      code: "github_unavailable",
      message: "GitHub API is temporarily unavailable. Try again soon.",
      retryable: true,
      status
    };
  }

  if (status === 401) {
    return {
      code: "github_bad_token",
      message: "GITHUB_TOKEN was rejected by GitHub.",
      retryable: false,
      status
    };
  }

  return {
    code: "github_api_error",
    message: `GitHub API request failed with status ${status}.`,
    retryable: status === 403 || status === 408 || status === 429,
    status
  };
}

export class GitHubClient {
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepoMetadata> {
    const metadata = await this.request<GitHubRepoResponse>(`/repos/${owner}/${repo}`);
    const branch = await this.request<{ commit: { sha: string } }>(
      `/repos/${owner}/${repo}/branches/${metadata.default_branch}`
    );

    if (metadata.archived) {
      throw new GitHubClientError({
        code: "repo_archived",
        message: "Repository is archived. The movie can still be generated from cached data later, but live analysis is disabled.",
        retryable: false,
        status: 422
      });
    }

    return {
      owner: metadata.owner.login,
      name: metadata.name,
      fullName: metadata.full_name,
      url: metadata.html_url,
      defaultBranch: metadata.default_branch,
      latestSha: branch.commit.sha,
      description: metadata.description ?? undefined,
      stars: metadata.stargazers_count,
      primaryLanguage: metadata.language ?? undefined,
      archived: Boolean(metadata.archived)
    };
  }

  async getCommitDetails(
    owner: string,
    repo: string,
    branch: string,
    limit: number,
    onProgress?: (completed: number, total: number) => void,
    commitSummaries?: GitHubCommitDetail[]
  ): Promise<GitHubCommitDetail[]> {
    const commits = commitSummaries ?? (await this.getCommitSummaries(owner, repo, branch, limit));

    const details: GitHubCommitDetail[] = [];
    for (const [index, commit] of commits.slice(0, limit).entries()) {
      details.push(await this.request<GitHubCommitDetail>(`/repos/${owner}/${repo}/commits/${commit.sha}`));
      onProgress?.(index + 1, commits.length);
    }

    return details;
  }

  async getCommitSummaries(
    owner: string,
    repo: string,
    branch: string,
    limit: number
  ): Promise<GitHubCommitDetail[]> {
    const commits: GitHubCommitListResponse = [];
    let page = 1;

    while (commits.length < limit) {
      const perPage = Math.min(GITHUB_MAX_PAGE_SIZE, limit - commits.length);
      const pageCommits = await this.request<GitHubCommitListResponse>(
        `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}&page=${page}`
      );

      commits.push(...pageCommits);
      if (pageCommits.length < perPage) {
        break;
      }
      page += 1;
    }

    if (commits.length === 0) {
      throw new GitHubClientError({
        code: "repo_empty",
        message: "Repository has no commits to analyze.",
        retryable: false,
        status: 409
      });
    }

    return commits.slice(0, limit).map((commit) => ({
      sha: commit.sha,
      commit: {
        message: commit.commit?.message ?? "(no commit message)",
        author: commit.commit?.author ?? null,
        committer: commit.commit?.committer ?? null
      },
      author: commit.author
        ? {
            login: commit.author.login,
            avatar_url: commit.author.avatar_url
          }
        : null
    }));
  }

  private async request<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${GITHUB_API_BASE}${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
        },
        cache: "no-store"
      });
    } catch (error) {
      throw new GitHubClientError({
        code: "github_network_error",
        message:
          error instanceof Error
            ? `Could not reach GitHub API: ${error.message}. Check network, proxy, or deployment egress settings.`
            : "Could not reach GitHub API. Check network, proxy, or deployment egress settings.",
        retryable: true
      });
    }

    if (!response.ok) {
      throw new GitHubClientError(mapGitHubError(response));
    }

    return (await response.json()) as T;
  }
}

import { GitHubClient, GitHubClientError } from "@/lib/github/github-client";
import { normalizeGitHubRepoInput } from "@/lib/github/github-url";
import { buildMovieCacheKey } from "@/lib/jobs/cache-key";
import { getJobStore } from "@/lib/jobs/in-memory-job-store";
import { buildRepoMovieFromGitHub } from "@/lib/movie/repo-parser";
import { getMovieStorage } from "@/lib/storage/in-memory-storage";

function asJobError(error: unknown) {
  if (error instanceof GitHubClientError) {
    return {
      code: error.details.code,
      message: error.details.message,
      retryable: error.details.retryable
    };
  }

  if (error instanceof Error) {
    return {
      code: "analysis_failed",
      message: error.message,
      retryable: false
    };
  }

  return {
    code: "analysis_failed",
    message: "The repository could not be analyzed.",
    retryable: false
  };
}

function hasGitHubToken() {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
}

function canFallBackToCommitSummaries(error: unknown) {
  return error instanceof GitHubClientError && error.details.code === "github_rate_limited";
}

export async function analyzeJob(jobId: string) {
  const jobStore = getJobStore();
  const storage = getMovieStorage();
  const job = await jobStore.get(jobId);

  if (!job) {
    throw new Error(`Analysis job ${jobId} was not found.`);
  }

  try {
    await jobStore.update(job.id, {
      status: "running",
      progressStage: "validating",
      progressPercent: 5
    });

    const repoInput = normalizeGitHubRepoInput(job.normalizedRepo);
    const client = new GitHubClient({ token: process.env.GITHUB_TOKEN });

    await jobStore.update(job.id, {
      progressStage: "fetching-repo",
      progressPercent: 15
    });
    const repo = await client.getRepository(repoInput.owner, repoInput.repo);

    const cacheKey = buildMovieCacheKey({
      provider: "github",
      owner: repo.owner,
      repo: repo.name,
      branch: repo.defaultBranch,
      latestSha: repo.latestSha,
      commitLimit: job.commitLimit
    });
    const cached = await storage.get(cacheKey);

    if (cached) {
      await jobStore.update(job.id, {
        status: "succeeded",
        progressStage: "ready",
        progressPercent: 100,
        resultStorageKey: cacheKey
      });
      return cached;
    }

    await jobStore.update(job.id, {
      progressStage: "fetching-commits",
      progressPercent: 28
    });
    const commitSummaries = await client.getCommitSummaries(
      repo.owner,
      repo.name,
      repo.defaultBranch,
      job.commitLimit
    );

    let commits = commitSummaries;
    if (hasGitHubToken()) {
      try {
        commits = await client.getCommitDetails(
          repo.owner,
          repo.name,
          repo.defaultBranch,
          job.commitLimit,
          (completed, total) => {
            const percent = 35 + Math.round((completed / Math.max(1, total)) * 35);
            void jobStore.update(job.id, {
              progressStage: "fetching-commits",
              progressPercent: Math.min(70, percent)
            });
          },
          commitSummaries
        );
      } catch (error) {
        if (!canFallBackToCommitSummaries(error)) {
          throw error;
        }
      }
    }

    await jobStore.update(job.id, {
      progressStage: "fetching-commits",
      progressPercent: 70
    });

    await jobStore.update(job.id, {
      progressStage: "analyzing-changes",
      progressPercent: 78
    });
    const movie = buildRepoMovieFromGitHub({
      repo,
      commits,
      commitLimit: job.commitLimit
    });

    await jobStore.update(job.id, {
      progressStage: "building-city",
      progressPercent: 88
    });

    await storage.set(cacheKey, movie);
    await jobStore.update(job.id, {
      status: "succeeded",
      progressStage: "ready",
      progressPercent: 100,
      resultStorageKey: cacheKey
    });

    return movie;
  } catch (error) {
    await jobStore.update(job.id, {
      status: "failed",
      progressStage: "failed",
      progressPercent: 100,
      error: asJobError(error)
    });
    return undefined;
  }
}

import { normalizeGitHubRepoInput } from "@/lib/github/github-url";
import { normalizeCommitLimit } from "@/lib/security/limits";
import { analyzeJob } from "@/worker/analyze-job";
import { getJobStore } from "./in-memory-job-store";
import type { AnalysisJob } from "./job-types";
import type { JobStore } from "./job-store";

export type CreateAnalysisJobOptions = {
  repo: string;
  commitLimit?: unknown;
  jobStore?: JobStore;
  autoStart?: boolean;
};

export async function createAnalysisJob(options: CreateAnalysisJobOptions): Promise<AnalysisJob> {
  const normalized = normalizeGitHubRepoInput(options.repo);
  const commitLimit = normalizeCommitLimit(options.commitLimit);
  const jobStore = options.jobStore ?? getJobStore();
  const job = await jobStore.create({
    repo: options.repo,
    normalizedRepo: normalized.fullName,
    commitLimit
  });

  if (options.autoStart ?? true) {
    queueMicrotask(() => {
      void analyzeJob(job.id);
    });
  }

  return job;
}

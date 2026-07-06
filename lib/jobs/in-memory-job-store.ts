import type { AnalysisJob, CreateAnalysisJobInput } from "./job-types";
import type { AnalysisJobUpdate, JobStore } from "./job-store";

type JobGlobal = typeof globalThis & {
  __repoMovieJobs?: InMemoryJobStore;
};

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, AnalysisJob>();

  async create(input: CreateAnalysisJobInput): Promise<AnalysisJob> {
    const now = new Date().toISOString();
    const job: AnalysisJob = {
      id: crypto.randomUUID(),
      repo: input.repo,
      normalizedRepo: input.normalizedRepo,
      commitLimit: input.commitLimit,
      status: "queued",
      progressStage: "validating",
      progressPercent: 0,
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(job.id, job);
    return job;
  }

  async get(id: string): Promise<AnalysisJob | undefined> {
    return this.jobs.get(id);
  }

  async update(id: string, update: AnalysisJobUpdate): Promise<AnalysisJob> {
    const current = this.jobs.get(id);
    if (!current) {
      throw new Error(`Analysis job ${id} was not found.`);
    }

    const next: AnalysisJob = {
      ...current,
      ...update,
      progressPercent: Math.max(0, Math.min(100, update.progressPercent ?? current.progressPercent)),
      updatedAt: new Date().toISOString()
    };

    this.jobs.set(id, next);
    return next;
  }

  async list(): Promise<AnalysisJob[]> {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function getJobStore(): InMemoryJobStore {
  const storeGlobal = globalThis as JobGlobal;
  storeGlobal.__repoMovieJobs ??= new InMemoryJobStore();
  return storeGlobal.__repoMovieJobs;
}

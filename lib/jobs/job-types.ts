export type AnalysisJobStatus = "queued" | "running" | "succeeded" | "failed";

export type AnalysisProgressStage =
  | "validating"
  | "fetching-repo"
  | "fetching-commits"
  | "analyzing-changes"
  | "building-city"
  | "storing-result"
  | "ready"
  | "failed";

export type AnalysisJobError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type AnalysisJob = {
  id: string;
  repo: string;
  normalizedRepo: string;
  commitLimit: number;
  status: AnalysisJobStatus;
  progressStage: AnalysisProgressStage;
  progressPercent: number;
  error?: AnalysisJobError;
  resultStorageKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAnalysisJobInput = {
  repo: string;
  normalizedRepo: string;
  commitLimit: number;
};

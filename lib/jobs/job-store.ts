import type { AnalysisJob, CreateAnalysisJobInput } from "./job-types";

export type AnalysisJobUpdate = Partial<
  Pick<
    AnalysisJob,
    "status" | "progressStage" | "progressPercent" | "error" | "resultStorageKey"
  >
>;

export interface JobStore {
  create(input: CreateAnalysisJobInput): Promise<AnalysisJob>;
  get(id: string): Promise<AnalysisJob | undefined>;
  update(id: string, update: AnalysisJobUpdate): Promise<AnalysisJob>;
  list(): Promise<AnalysisJob[]>;
}

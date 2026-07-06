"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { AnalysisJob } from "@/lib/jobs/job-types";

const stageLabels: Record<AnalysisJob["progressStage"], string> = {
  validating: "Validating repository",
  "fetching-repo": "Fetching repository metadata",
  "fetching-commits": "Fetching commit details",
  "analyzing-changes": "Analyzing file changes",
  "building-city": "Building code city",
  "storing-result": "Storing movie artifact",
  ready: "Movie ready",
  failed: "Analysis failed"
};

type JobStatusProps = {
  job?: AnalysisJob;
  error?: string;
};

export function JobStatus({ job, error }: JobStatusProps) {
  if (!job && !error) {
    return (
      <div className="rounded-[0.45rem] border border-stone-800/80 bg-[#0d0f0c]/70 p-3 text-sm text-stone-400">
        Load a repository or play the sample movie.
      </div>
    );
  }

  if (error || job?.status === "failed") {
    return (
      <div className="rounded-[0.45rem] border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-100">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Could not generate movie
        </div>
        <p className="mt-2 text-red-100/80">{error ?? job?.error?.message}</p>
      </div>
    );
  }

  const done = job?.status === "succeeded";
  return (
    <div className="rounded-[0.45rem] border border-stone-800/80 bg-[#0d0f0c]/70 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-stone-200">
          {done ? <CheckCircle2 className="h-4 w-4 text-teal-300" /> : <Loader2 className="h-4 w-4 animate-spin text-amber-300" />}
          <span className="truncate">{job ? stageLabels[job.progressStage] : "Queued"}</span>
        </div>
        <span className="font-mono text-xs text-stone-400">{job?.progressPercent ?? 0}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 via-teal-300 to-rose-300 transition-all duration-500"
          style={{ width: `${job?.progressPercent ?? 0}%` }}
        />
      </div>
    </div>
  );
}

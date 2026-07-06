"use client";

import { useEffect, useState } from "react";
import type { AnalysisJob } from "@/lib/jobs/job-types";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";
import { JobStatus } from "./JobStatus";
import { MoviePlayer } from "./MoviePlayer";

type MovieJobPageProps = {
  jobId: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed with ${response.status}`);
  }
  return body;
}

export function MovieJobPage({ jobId }: MovieJobPageProps) {
  const [job, setJob] = useState<AnalysisJob | undefined>();
  const [movie, setMovie] = useState<RepoMovie | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const jobResult = await readApi<{ job: AnalysisJob }>(await fetch(`/api/jobs/${jobId}`));
        if (cancelled) {
          return;
        }
        setJob(jobResult.job);
        if (jobResult.job.status === "succeeded") {
          const movieResult = await readApi<{ movie: RepoMovie }>(await fetch(`/api/movies/${jobId}`));
          if (!cancelled) {
            setMovie(movieResult.movie);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load shared movie.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <main className="mx-auto min-h-screen max-w-[96rem] px-4 py-4">
      {movie ? (
        <MoviePlayer key={`${movie.repo.fullName}:${movie.repo.latestSha}`} movie={movie} jobId={jobId} />
      ) : (
        <div className="mx-auto mt-20 max-w-xl">
          <JobStatus job={job} error={error} />
        </div>
      )}
    </main>
  );
}

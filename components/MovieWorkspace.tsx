"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalysisJob } from "@/lib/jobs/job-types";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";
import { sampleMovie } from "@/lib/movie/sample-data";
import { ExampleGallery } from "./ExampleGallery";
import { JobStatus } from "./JobStatus";
import { MoviePlayer } from "./MoviePlayer";
import { RepoInput } from "./RepoInput";

async function readApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed with ${response.status}`);
  }
  return body;
}

export function MovieWorkspace() {
  const searchParams = useSearchParams();
  const initialRepo = searchParams.get("repo") ?? "";
  const autoStarted = useRef(false);
  const [job, setJob] = useState<AnalysisJob | undefined>();
  const [movie, setMovie] = useState<RepoMovie | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const startJob = useCallback(async (repo: string, commitLimit = 60) => {
    setLoading(true);
    setError(undefined);
    setMovie(undefined);
    try {
      const created = await readApi<{ job: AnalysisJob }>(
        await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo, commitLimit })
        })
      );
      setJob(created.job);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create analysis job.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRepo && !autoStarted.current) {
      autoStarted.current = true;
      void startJob(initialRepo, 60);
    }
  }, [initialRepo, startJob]);

  useEffect(() => {
    if (!job || job.status === "succeeded" || job.status === "failed") {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const next = await readApi<{ job: AnalysisJob }>(await fetch(`/api/jobs/${job.id}`));
        setJob(next.job);
        if (next.job.status === "failed") {
          setLoading(false);
        }
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : "Could not refresh job status.");
        setLoading(false);
      }
    }, 900);

    return () => window.clearInterval(interval);
  }, [job]);

  useEffect(() => {
    if (job?.status !== "succeeded") {
      return;
    }

    const succeededJobId = job.id;
    let cancelled = false;
    async function loadMovie() {
      try {
        const result = await readApi<{ movie: RepoMovie }>(await fetch(`/api/movies/${succeededJobId}`));
        if (!cancelled) {
          setMovie(result.movie);
          setLoading(false);
        }
      } catch (movieError) {
        if (!cancelled) {
          setError(movieError instanceof Error ? movieError.message : "Could not load movie artifact.");
          setLoading(false);
        }
      }
    }
    void loadMovie();
    return () => {
      cancelled = true;
    };
  }, [job]);

  const visibleMovie = movie ?? sampleMovie;

  return (
    <main className="mx-auto grid min-h-screen max-w-[96rem] gap-4 px-4 py-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-4">
        <section className="rounded-md border border-stone-800 bg-stone-950/65 p-4">
          <div className="mb-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Repo Movie Machine</p>
            <h2 className="mt-2 text-xl font-semibold text-stone-50">Code city movies from GitHub history.</h2>
          </div>
          <RepoInput onSubmit={startJob} isLoading={loading} initialRepo={initialRepo} />
          <div className="mt-4">
            <ExampleGallery onSelect={(repo) => startJob(repo, 30)} disabled={loading} />
          </div>
        </section>
        <JobStatus job={job} error={error} />
        <section className="rounded-md border border-stone-800 bg-stone-950/45 p-4 text-xs leading-5 text-stone-400">
          GitHub token stays on the server. Without <span className="font-mono text-stone-200">GITHUB_TOKEN</span>, public
          API rate limits are lower.
        </section>
      </aside>
      <MoviePlayer key={`${visibleMovie.repo.fullName}:${visibleMovie.repo.latestSha}`} movie={visibleMovie} jobId={movie ? job?.id : undefined} />
    </main>
  );
}

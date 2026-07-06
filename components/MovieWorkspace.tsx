"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalysisJob } from "@/lib/jobs/job-types";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";
import { sampleMovie } from "@/lib/movie/sample-data";
import { DEFAULT_COMMIT_LIMIT } from "@/lib/security/limits";
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

  const startJob = useCallback(async (repo: string, commitLimit = DEFAULT_COMMIT_LIMIT) => {
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
      void startJob(initialRepo, DEFAULT_COMMIT_LIMIT);
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
    <main className="min-h-screen px-3 py-3 text-stone-100 sm:px-4 sm:py-4">
      <div className="mx-auto grid max-w-[100rem] gap-3 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 lg:sticky lg:top-4">
          <section className="rounded-[0.45rem] border border-stone-700/80 bg-[#10120f]/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <div className="mb-4">
              <p className="font-mono text-[0.68rem] uppercase text-amber-300">Repo Movie Machine</p>
              <h2 className="mt-2 text-xl font-semibold leading-tight text-stone-50">
                Turn commits into a live trend movie.
              </h2>
            </div>
          <RepoInput onSubmit={startJob} isLoading={loading} initialRepo={initialRepo} />
          <div className="mt-4">
            <ExampleGallery onSelect={(repo) => startJob(repo, 30)} disabled={loading} />
          </div>
        </section>
        <JobStatus job={job} error={error} />
        <section className="rounded-[0.45rem] border border-stone-800/90 bg-[#0d0f0c]/78 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono text-lg font-semibold text-stone-50">{visibleMovie.stats.totalCommits}</p>
              <p className="mt-0.5 text-[0.65rem] uppercase text-stone-500">commits</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-stone-50">{visibleMovie.stats.activeFiles}</p>
              <p className="mt-0.5 text-[0.65rem] uppercase text-stone-500">active</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-stone-50">{visibleMovie.directories.length}</p>
              <p className="mt-0.5 text-[0.65rem] uppercase text-stone-500">paths</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {visibleMovie.stats.primaryLanguages.slice(0, 5).map((language) => (
              <div key={language.language} className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: language.color }} />
                <span className="truncate text-stone-300">{language.language}</span>
                <span className="font-mono text-stone-500">{language.files}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[0.45rem] border border-stone-800/80 bg-[#0d0f0c]/60 p-4 text-xs leading-5 text-stone-400">
          Server-only GitHub access. No token is exposed to the browser.
        </section>
      </aside>
      <MoviePlayer key={`${visibleMovie.repo.fullName}:${visibleMovie.repo.latestSha}`} movie={visibleMovie} jobId={movie ? job?.id : undefined} />
      </div>
    </main>
  );
}

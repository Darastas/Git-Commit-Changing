"use client";

import Image from "next/image";
import { Calendar, Files } from "lucide-react";
import type { MovieCommit } from "@/lib/movie/repo-movie-types";

type CommitPanelProps = {
  commits: MovieCommit[];
  currentIndex: number;
  onSelectCommit: (index: number) => void;
};

function formatCommitDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "Unknown date", time: "--:--" };
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return {
    date: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function statusClasses(status: string) {
  if (status === "added") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "removed") {
    return "border-red-300/25 bg-red-400/10 text-red-200";
  }

  if (status === "renamed") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-200";
  }

  return "border-sky-300/25 bg-sky-400/10 text-sky-200";
}

export function CommitPanel({ commits, currentIndex, onSelectCommit }: CommitPanelProps) {
  const commit = commits[Math.min(currentIndex, commits.length - 1)] ?? commits[0];

  if (!commit) {
    return null;
  }

  const currentDate = formatCommitDate(commit.date);
  const authorHandle = commit.authorLogin ? `@${commit.authorLogin}` : commit.authorName;
  const visibleFiles = commit.changedFiles.slice(0, 5);
  const hiddenFileCount = Math.max(0, commit.changedFiles.length - visibleFiles.length);

  return (
    <section className="rounded-[0.45rem] border border-stone-800/80 bg-[#0d0f0c]/86 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {commit.authorAvatar ? (
            <Image
              src={commit.authorAvatar}
              alt={`${commit.authorName} avatar`}
              width={44}
              height={44}
              className="h-11 w-11 rounded-full border border-stone-700 object-cover shadow-[0_0_24px_rgba(250,204,21,0.12)]"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-sm font-semibold text-stone-300">
              {commit.authorName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-stone-100">{commit.authorName}</p>
            <p className="truncate font-mono text-xs text-teal-200">{authorHandle}</p>
            <p className="mt-1 text-xs text-stone-500">
              {currentDate.date} · {currentDate.time}
            </p>
          </div>
        </div>
        <div className="rounded-[0.35rem] border border-stone-700/80 bg-[#090b0a] px-2 py-1 font-mono text-xs text-stone-300">
          {currentIndex + 1}/{commits.length}
        </div>
      </div>

      <div className="mt-4 rounded-[0.4rem] border border-stone-800 bg-[#090b0a]/76 p-3">
        <p className="text-sm font-semibold leading-5 text-stone-100">{commit.message}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-[0.35rem] border border-stone-800 bg-stone-950/45 px-2 py-2 text-stone-300">
            <span className="block text-[0.65rem] uppercase text-stone-500">sha</span>
            <span className="font-mono">{commit.shortSha}</span>
          </div>
          <div className="rounded-[0.35rem] border border-emerald-300/20 bg-emerald-400/10 px-2 py-2 text-emerald-200">
            <span className="block text-[0.65rem] uppercase text-emerald-300/70">add</span>
            <span>+{commit.additions}</span>
          </div>
          <div className="rounded-[0.35rem] border border-red-300/20 bg-red-400/10 px-2 py-2 text-red-200">
            <span className="block text-[0.65rem] uppercase text-red-300/70">del</span>
            <span>-{commit.deletions}</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase text-stone-500">
          <span className="inline-flex items-center gap-2">
            <Files className="h-3.5 w-3.5 text-amber-300" />
            Changed files
          </span>
          <span>{commit.changedFiles.length}</span>
        </div>
        <div className="grid gap-1.5">
          {visibleFiles.map((file) => (
            <div
              key={`${commit.sha}:${file.path}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.35rem] border border-stone-800 bg-[#090b0a]/68 px-2.5 py-2 text-xs"
            >
              <span className={`rounded-[0.25rem] border px-1.5 py-0.5 text-[0.65rem] ${statusClasses(file.status)}`}>
                {file.status}
              </span>
              <span className="truncate font-mono text-stone-300">{file.path}</span>
              <span className="text-stone-500">+/-{file.changes}</span>
            </div>
          ))}
          {hiddenFileCount > 0 ? (
            <div className="rounded-[0.35rem] border border-stone-800 bg-[#090b0a]/46 px-2.5 py-2 text-xs text-stone-500">
              +{hiddenFileCount} more files
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase text-stone-400">Commit trail</h2>
          <span className="text-xs text-stone-500">{commits.length} commits</span>
        </div>
        <div className="grid gap-2">
          {commits.map((trailCommit, trailIndex) => {
            const trailDate = formatCommitDate(trailCommit.date);
            const isCurrent = trailIndex === currentIndex;

            return (
              <button
                key={trailCommit.sha}
                type="button"
                aria-label={`Jump to commit ${trailIndex + 1}: ${trailCommit.message}`}
                className={`grid grid-cols-[1.2rem_minmax(0,1fr)] gap-2 rounded-[0.4rem] border px-2.5 py-2 text-left transition ${
                  isCurrent
                    ? "border-amber-300/55 bg-amber-300/12 shadow-[0_0_24px_rgba(250,204,21,0.08)]"
                    : "border-stone-800 bg-[#090b0a]/54 hover:border-teal-300/60"
                }`}
                onClick={() => onSelectCommit(trailIndex)}
              >
                <span className="mt-1 grid justify-items-center gap-1">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isCurrent ? "bg-amber-300 shadow-[0_0_16px_rgba(250,204,21,0.55)]" : "bg-stone-600"
                    }`}
                  />
                  <span className="h-full min-h-7 w-px bg-stone-800" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-stone-100">{trailCommit.message}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-stone-500" />
                      {trailDate.date}
                    </span>
                    <span>{trailCommit.authorName}</span>
                    <span>{trailCommit.changedFiles.length} files</span>
                    <span className="text-emerald-300">+{trailCommit.additions}</span>
                    <span className="text-red-300">-{trailCommit.deletions}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

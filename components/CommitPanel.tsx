"use client";

import Image from "next/image";
import { Calendar, GitCommitHorizontal } from "lucide-react";
import type { MovieCommit } from "@/lib/movie/repo-movie-types";

type CommitPanelProps = {
  commit: MovieCommit;
  index: number;
  total: number;
};

export function CommitPanel({ commit, index, total }: CommitPanelProps) {
  return (
    <section className="rounded-md border border-stone-800 bg-stone-950/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {commit.authorAvatar ? (
            <Image
              src={commit.authorAvatar}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-stone-700"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-xs text-stone-300">
              {commit.authorName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-100">{commit.message}</p>
            <p className="truncate text-xs text-stone-400">{commit.authorName}</p>
          </div>
        </div>
        <div className="rounded-md border border-stone-800 bg-stone-900 px-2 py-1 font-mono text-xs text-stone-300">
          {index + 1}/{total}
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-stone-400">
        <div className="flex items-center gap-2">
          <GitCommitHorizontal className="h-3.5 w-3.5 text-teal-300" />
          <span className="font-mono">{commit.shortSha}</span>
          <span>{commit.changedFiles.length} files</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-amber-300" />
          {new Date(commit.date).toLocaleString()}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-emerald-400/10 px-3 py-2 text-emerald-200">+{commit.additions}</div>
        <div className="rounded-md bg-red-400/10 px-3 py-2 text-red-200">-{commit.deletions}</div>
      </div>
    </section>
  );
}

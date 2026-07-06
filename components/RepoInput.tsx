"use client";

import { Github, Loader2, Play } from "lucide-react";
import { useState } from "react";

type RepoInputProps = {
  onSubmit: (repo: string, commitLimit: number) => void;
  isLoading?: boolean;
  initialRepo?: string;
};

export function RepoInput({ onSubmit, isLoading = false, initialRepo = "" }: RepoInputProps) {
  const [repo, setRepo] = useState(initialRepo);
  const [commitLimit, setCommitLimit] = useState(60);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(repo, commitLimit);
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400" htmlFor="repo-url">
        Public GitHub repository
      </label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem_3rem]">
        <div className="relative">
          <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            id="repo-url"
            className="h-11 w-full rounded-md border border-stone-700 bg-stone-950/80 pl-9 pr-3 text-sm text-stone-100 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
            placeholder="owner/repo or github.com/owner/repo"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            disabled={isLoading}
          />
        </div>
        <select
          aria-label="Commit limit"
          className="h-11 rounded-md border border-stone-700 bg-stone-950/80 px-3 text-sm text-stone-100 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
          value={commitLimit}
          onChange={(event) => setCommitLimit(Number(event.target.value))}
          disabled={isLoading}
        >
          <option value={30}>30 commits</option>
          <option value={60}>60 commits</option>
          <option value={100}>100 commits</option>
        </select>
        <button
          type="submit"
          aria-label="Generate repo movie"
          className="flex h-11 items-center justify-center rounded-md bg-amber-300 text-stone-950 transition hover:bg-amber-200 disabled:bg-stone-700 disabled:text-stone-400"
          disabled={isLoading || repo.trim().length === 0}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
      </div>
    </form>
  );
}

"use client";

import { Github, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { DEFAULT_COMMIT_LIMIT, SUPPORTED_COMMIT_LIMITS } from "@/lib/security/limits";

type RepoInputProps = {
  onSubmit: (repo: string, commitLimit: number) => void;
  isLoading?: boolean;
  initialRepo?: string;
};

export function RepoInput({ onSubmit, isLoading = false, initialRepo = "" }: RepoInputProps) {
  const [repo, setRepo] = useState(initialRepo);
  const [commitLimit, setCommitLimit] = useState<number>(DEFAULT_COMMIT_LIMIT);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(repo, commitLimit);
      }}
    >
      <label className="text-xs font-semibold uppercase text-stone-400" htmlFor="repo-url">
        Public GitHub repository
      </label>
      <div className="grid gap-2">
        <div className="relative">
          <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            id="repo-url"
            className="h-11 w-full rounded-[0.4rem] border border-stone-700/90 bg-[#090b0a]/90 pl-9 pr-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
            placeholder="owner/repo"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-2">
          <div className="grid grid-cols-4 rounded-[0.4rem] border border-stone-700/80 bg-[#090b0a]/80 p-1">
            {SUPPORTED_COMMIT_LIMITS.map((limit) => (
              <button
                key={limit}
                type="button"
                className={`h-9 rounded-[0.32rem] text-xs font-semibold transition ${
                  commitLimit === limit
                    ? "bg-stone-100 text-stone-950 shadow-[0_0_22px_rgba(250,204,21,0.22)]"
                    : "text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"
                }`}
                onClick={() => setCommitLimit(limit)}
                disabled={isLoading}
              >
                {limit}
              </button>
            ))}
          </div>
          <button
            type="submit"
            aria-label="Generate repo movie"
            className="flex h-11 items-center justify-center rounded-[0.4rem] bg-amber-300 text-stone-950 transition hover:bg-amber-200 disabled:bg-stone-700 disabled:text-stone-400"
            disabled={isLoading || repo.trim().length === 0}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
        </div>
      </div>
    </form>
  );
}

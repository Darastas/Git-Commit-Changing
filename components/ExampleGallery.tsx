"use client";

import { GitBranch } from "lucide-react";

const examples = ["octocat/Hello-World", "vercel/next.js", "facebook/react"];

type ExampleGalleryProps = {
  onSelect: (repo: string) => void;
  disabled?: boolean;
};

export function ExampleGallery({ onSelect, disabled = false }: ExampleGalleryProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((repo) => (
        <button
          key={repo}
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-700 bg-stone-900/80 px-2.5 text-xs font-medium text-stone-300 transition hover:border-teal-300 hover:text-teal-100 disabled:opacity-50"
          onClick={() => onSelect(repo)}
          disabled={disabled}
        >
          <GitBranch className="h-3.5 w-3.5" />
          {repo}
        </button>
      ))}
    </div>
  );
}

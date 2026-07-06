"use client";

import { FileCode2, Flame, Layers3 } from "lucide-react";
import type { MovieFile } from "@/lib/movie/repo-movie-types";

type FileInspectorProps = {
  file?: MovieFile;
};

export function FileInspector({ file }: FileInspectorProps) {
  if (!file) {
    return (
      <section className="rounded-md border border-stone-800 bg-stone-950/55 p-4 text-sm text-stone-400">
        Select a building to inspect a file.
      </section>
    );
  }

  return (
    <section className="rounded-md border border-stone-800 bg-stone-950/55 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: file.color }} />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-stone-100">{file.name}</p>
          <p className="break-words font-mono text-xs text-stone-500">{file.path}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-stone-300">
        <div className="flex items-center justify-between gap-3 rounded-md bg-stone-900/80 px-3 py-2">
          <span className="inline-flex items-center gap-2">
            <FileCode2 className="h-3.5 w-3.5 text-teal-300" />
            Language
          </span>
          <span>{file.language}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-stone-900/80 px-3 py-2">
          <span className="inline-flex items-center gap-2">
            <Layers3 className="h-3.5 w-3.5 text-amber-300" />
            Size score
          </span>
          <span>{Math.round(file.sizeScore * 100)}%</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-stone-900/80 px-3 py-2">
          <span className="inline-flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-red-300" />
            Activity
          </span>
          <span>{Math.round(file.activityScore * 100)}%</span>
        </div>
      </div>
    </section>
  );
}

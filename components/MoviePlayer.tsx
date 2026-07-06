"use client";

import { Download, FileJson, Pause, Play, Share2, SkipBack, SkipForward, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";
import { CodeCityCanvas } from "./CodeCityCanvas";
import { CommitPanel } from "./CommitPanel";
import { FileInspector } from "./FileInspector";
import { Timeline } from "./Timeline";

type MoviePlayerProps = {
  movie: RepoMovie;
  jobId?: string;
};

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MoviePlayer({ movie, jobId }: MoviePlayerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [recording, setRecording] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(() => Object.keys(movie.files)[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const frameMax = Math.max(0, movie.frames.length - 1);
  const commit = movie.commits[Math.min(frameIndex, movie.commits.length - 1)] ?? movie.commits[0];
  const selectedFile = selectedPath ? movie.files[selectedPath] : undefined;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !jobId) {
      return undefined;
    }
    return `${window.location.origin}/movie/${jobId}`;
  }, [jobId]);

  useEffect(() => {
    if (!playing || frameMax === 0) {
      return;
    }
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current >= frameMax ? 0 : current + 1));
    }, 1200 / speed);
    return () => window.clearInterval(interval);
  }, [frameMax, playing, speed]);

  function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !("captureStream" in canvas) || !("MediaRecorder" in window)) {
      return;
    }

    chunksRef.current = [];
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      setRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      downloadBlob(`${movie.repo.owner}-${movie.repo.name}-movie.webm`, new Blob(chunksRef.current, { type: "video/webm" }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setPlaying(true);
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="grid min-h-0 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-800 bg-stone-950/55 p-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-stone-100">{movie.repo.fullName}</h1>
            <p className="truncate text-xs text-stone-400">{movie.repo.description ?? "Repository evolution movie"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Jump to start"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-300"
              onClick={() => setFrameIndex(0)}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause movie" : "Play movie"}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-300 text-stone-950 hover:bg-amber-200"
              onClick={() => setPlaying((current) => !current)}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button
              type="button"
              aria-label="Jump to end"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-300"
              onClick={() => setFrameIndex(frameMax)}
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <select
              aria-label="Playback speed"
              className="h-9 rounded-md border border-stone-700 bg-stone-900 px-2 text-xs text-stone-200"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        </div>

        <CodeCityCanvas
          ref={canvasRef}
          movie={movie}
          frameIndex={frameIndex}
          selectedPath={selectedPath}
          onSelectFile={setSelectedPath}
        />

        <div className="rounded-md border border-stone-800 bg-stone-950/55 p-3">
          <Timeline frameIndex={frameIndex} max={frameMax} onChange={setFrameIndex} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
            <span>
              {movie.stats.totalCommits} commits · {movie.stats.activeFiles} active files · {movie.stats.totalChanges} changes
            </span>
            <div className="flex items-center gap-2">
              {shareUrl ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-700 px-2.5 text-stone-200 hover:border-teal-300"
                  onClick={() => void navigator.clipboard.writeText(shareUrl)}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-700 px-2.5 text-stone-200 hover:border-teal-300"
                onClick={() => {
                  downloadBlob(
                    `${movie.repo.owner}-${movie.repo.name}-movie.json`,
                    new Blob([JSON.stringify(movie, null, 2)], { type: "application/json" })
                  );
                }}
              >
                <FileJson className="h-3.5 w-3.5" />
                JSON
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-700 px-2.5 text-stone-200 hover:border-teal-300"
                onClick={() => {
                  canvasRef.current?.toBlob((blob) => {
                    if (blob) {
                      downloadBlob(`${movie.repo.owner}-${movie.repo.name}-snapshot.png`, blob);
                    }
                  }, "image/png");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                PNG
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-700 px-2.5 text-stone-200 hover:border-teal-300"
                onClick={toggleRecording}
              >
                <Video className="h-3.5 w-3.5" />
                {recording ? "Stop" : "WebM"}
              </button>
            </div>
          </div>
        </div>
      </section>
      <aside className="grid content-start gap-4">
        {commit ? <CommitPanel commit={commit} index={frameIndex} total={movie.commits.length} /> : null}
        <FileInspector file={selectedFile} />
      </aside>
    </div>
  );
}

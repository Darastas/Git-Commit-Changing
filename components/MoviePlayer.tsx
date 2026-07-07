"use client";

import { Download, FileJson, Pause, Play, Share2, SkipBack, SkipForward, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";
import {
  getPreferredWebMRecorderOptions,
  getWebMBlobType,
  getWebMRecordingDurationMs,
  WEBM_RECORDING_FRAME_RATE
} from "@/lib/movie/recording";
import { advanceTrendProgress } from "@/lib/movie/trend";
import { CodeCityCanvas, type ChartColorTheme, type ChartCurveStyle } from "./CodeCityCanvas";
import { CommitPanel } from "./CommitPanel";
import { FileInspector } from "./FileInspector";
import { LanguageToggle, useLanguage } from "./language";
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
  const { language, t } = useLanguage();
  const [playheadProgress, setPlayheadProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [recording, setRecording] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [speed, setSpeed] = useState(1);
  const [curveStyle, setCurveStyle] = useState<ChartCurveStyle>("smooth");
  const [colorTheme, setColorTheme] = useState<ChartColorTheme>("geist");
  const [selectedPath, setSelectedPath] = useState<string | undefined>(() => Object.keys(movie.files)[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingStopQueuedRef = useRef(false);
  const frameMax = Math.max(0, movie.frames.length - 1);
  const frameIndex = frameMax === 0 ? 0 : Math.min(frameMax, Math.round(playheadProgress * frameMax));
  const commit = movie.commits[Math.min(frameIndex, movie.commits.length - 1)] ?? movie.commits[0];
  const fallbackSelectedPath = Object.keys(movie.files)[0];
  const effectiveSelectedPath = selectedPath && movie.files[selectedPath] ? selectedPath : fallbackSelectedPath;
  const selectedFile = effectiveSelectedPath ? movie.files[effectiveSelectedPath] : undefined;
  const playbackDurationMs = Math.max(2400, Math.max(1, movie.commits.length) * 1200);
  const activePlaybackDurationMs = recording ? getWebMRecordingDurationMs(movie.commits.length) : playbackDurationMs;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !jobId) {
      return undefined;
    }
    return `${window.location.origin}/movie/${jobId}`;
  }, [jobId]);

  function progressForFrame(index: number) {
    return frameMax === 0 ? 0 : Math.min(1, Math.max(0, index / frameMax));
  }

  function setProgressForFrame(index: number) {
    setPlayheadProgress(progressForFrame(index));
  }

  useEffect(() => {
    if (!playing || frameMax === 0) {
      return;
    }

    let animationFrame = 0;
    let lastTimestamp: number | undefined;

    function tick(timestamp: number) {
      const deltaMs = lastTimestamp === undefined ? 0 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      setPlayheadProgress((currentProgress) => {
        const nextProgress = advanceTrendProgress({
          currentProgress,
          deltaMs,
          speed: recording ? 1 : speed,
          playing,
          durationMs: activePlaybackDurationMs,
          loop: !recording
        });

        if (recording && nextProgress >= 1 && !recordingStopQueuedRef.current) {
          recordingStopQueuedRef.current = true;
          window.setTimeout(() => {
            const recorder = recorderRef.current;
            if (recorder && recorder.state !== "inactive") {
              recorder.requestData();
              recorder.stop();
            }
          }, 0);
        }

        return nextProgress;
      });
      animationFrame = window.requestAnimationFrame(tick);
    }

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activePlaybackDurationMs, frameMax, playing, recording, speed]);

  function toggleRecording() {
    if (recording) {
      recordingStopQueuedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.requestData();
        recorder.stop();
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !("captureStream" in canvas) || !("MediaRecorder" in window)) {
      return;
    }

    chunksRef.current = [];
    recordingStopQueuedRef.current = false;
    setPlayheadProgress(0);
    const stream = canvas.captureStream(WEBM_RECORDING_FRAME_RATE);
    const recorderOptions = getPreferredWebMRecorderOptions(
      typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : undefined,
      { width: canvas.width, height: canvas.height }
    );
    const recorder = new MediaRecorder(stream, recorderOptions);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const completed = recordingStopQueuedRef.current;
      recordingStopQueuedRef.current = false;
      setRecording(false);
      setPlaying(false);
      if (completed) {
        setPlayheadProgress(1);
      }
      stream.getTracks().forEach((track) => track.stop());
      if (chunksRef.current.length > 0) {
        downloadBlob(
          `${movie.repo.owner}-${movie.repo.name}-movie.webm`,
          new Blob(chunksRef.current, { type: getWebMBlobType(recorderOptions) })
        );
      }
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
    setPlaying(true);
  }

  const languageStrip = movie.stats.primaryLanguages.slice(0, 6);
  const shareLabel = shareStatus === "copied" ? t("shareCopied") : shareStatus === "failed" ? t("copyFailed") : t("share");
  const shareTitle =
    shareStatus === "copied" ? t("shareLinkCopied") : shareStatus === "failed" ? t("copyFailed") : t("copyShareLink");

  return (
    <div className="grid min-h-0 gap-3">
      <section className="grid min-h-0 gap-3">
        <div className="rounded-[0.45rem] border border-stone-700/80 bg-[#10120f]/86 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight text-stone-50">{movie.repo.fullName}</h1>
              <p className="truncate text-xs text-stone-400">{movie.repo.description ?? t("repositoryFallback")}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] uppercase text-stone-400">
                <span className="rounded-[0.3rem] border border-stone-700/80 bg-[#090b0a]/80 px-2 py-1">
                  {movie.stats.totalCommits} {t("commits")}
                </span>
                <span className="rounded-[0.3rem] border border-stone-700/80 bg-[#090b0a]/80 px-2 py-1">
                  {movie.stats.totalFiles} {t("files")}
                </span>
                <span className="rounded-[0.3rem] border border-stone-700/80 bg-[#090b0a]/80 px-2 py-1">
                  {movie.repo.defaultBranch}
                </span>
                {typeof movie.repo.stars === "number" ? (
                  <span className="rounded-[0.3rem] border border-stone-700/80 bg-[#090b0a]/80 px-2 py-1">
                    {movie.repo.stars} {t("stars")}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <LanguageToggle />
            <button
              type="button"
              aria-label={t("jumpToStart")}
              title={t("jumpToStart")}
              className="flex h-9 w-9 items-center justify-center rounded-[0.35rem] border border-stone-700 bg-[#090b0a] text-stone-200 hover:border-amber-300"
              onClick={() => setProgressForFrame(0)}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={playing ? t("pauseMovie") : t("playMovie")}
              title={playing ? t("pauseMovie") : t("playMovie")}
              className="flex h-9 w-9 items-center justify-center rounded-[0.35rem] bg-amber-300 text-stone-950 shadow-[0_0_28px_rgba(250,204,21,0.24)] hover:bg-amber-200"
              onClick={() => setPlaying((current) => !current)}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button
              type="button"
              aria-label={t("jumpToEnd")}
              title={t("jumpToEnd")}
              className="flex h-9 w-9 items-center justify-center rounded-[0.35rem] border border-stone-700 bg-[#090b0a] text-stone-200 hover:border-amber-300"
              onClick={() => setProgressForFrame(frameMax)}
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <select
              aria-label={t("speed")}
              className="h-9 rounded-[0.35rem] border border-stone-700 bg-[#090b0a] px-2 text-xs text-stone-200"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
            <select
              aria-label={t("curveStyle")}
              className="h-9 rounded-[0.35rem] border border-stone-700 bg-[#090b0a] px-2 text-xs text-stone-200"
              value={curveStyle}
              onChange={(event) => setCurveStyle(event.target.value as ChartCurveStyle)}
            >
              <option value="smooth">{t("curveSmooth")}</option>
              <option value="linear">{t("curveLinear")}</option>
              <option value="dash">{t("curveDash")}</option>
            </select>
            <select
              aria-label={t("colorTheme")}
              className="h-9 rounded-[0.35rem] border border-stone-700 bg-[#090b0a] px-2 text-xs text-stone-200"
              value={colorTheme}
              onChange={(event) => setColorTheme(event.target.value as ChartColorTheme)}
            >
              <option value="geist">Geist</option>
              <option value="primer">Primer</option>
              <option value="linear">Linear</option>
              <option value="mono">Mono</option>
              <option value="sage">Sage</option>
            </select>
            </div>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-stone-900">
            {languageStrip.map((language) => (
              <div
                key={language.language}
                title={`${language.language}: ${language.files} files`}
                style={{
                  backgroundColor: language.color,
                  width: `${Math.max(8, (language.files / Math.max(1, movie.stats.totalFiles)) * 100)}%`
                }}
              />
            ))}
          </div>
        </div>

        <CodeCityCanvas
          ref={canvasRef}
          movie={movie}
          language={language}
          playheadProgress={playheadProgress}
          curveStyle={curveStyle}
          colorTheme={colorTheme}
          selectedPath={effectiveSelectedPath}
          onSelectFile={setSelectedPath}
        />

        <div className="rounded-[0.45rem] border border-stone-800/80 bg-[#10120f]/78 p-3">
          <Timeline frameIndex={frameIndex} max={frameMax} onChange={setProgressForFrame} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
            <span>
              {movie.stats.totalCommits} {t("commits")} · {movie.stats.activeFiles} {t("active")} · {movie.stats.totalChanges} {t("changes")}
            </span>
            <div className="flex items-center gap-2">
              {shareUrl ? (
                <button
                  type="button"
                  aria-label={shareTitle}
                  title={shareTitle}
                  className="inline-flex h-8 items-center gap-2 rounded-[0.35rem] border border-stone-700 bg-[#090b0a]/70 px-2.5 text-stone-200 hover:border-teal-300"
                  onClick={async () => {
                    setShareStatus("idle");
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setShareStatus("copied");
                    } catch {
                      setShareStatus("failed");
                    }
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shareLabel}
                </button>
              ) : null}
              <button
                type="button"
                title={t("exportJson")}
                className="inline-flex h-8 items-center gap-2 rounded-[0.35rem] border border-stone-700 bg-[#090b0a]/70 px-2.5 text-stone-200 hover:border-teal-300"
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
                title={t("exportPng")}
                className="inline-flex h-8 items-center gap-2 rounded-[0.35rem] border border-stone-700 bg-[#090b0a]/70 px-2.5 text-stone-200 hover:border-teal-300"
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
                title={t("recordWebM")}
                className="inline-flex h-8 items-center gap-2 rounded-[0.35rem] border border-stone-700 bg-[#090b0a]/70 px-2.5 text-stone-200 hover:border-teal-300"
                onClick={toggleRecording}
              >
                <Video className="h-3.5 w-3.5" />
                {recording ? t("stop") : "WebM"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {commit ? (
            <CommitPanel
              commits={movie.commits}
              currentIndex={frameIndex}
              onSelectCommit={(index) => {
                setProgressForFrame(index);
                setPlaying(false);
              }}
            />
          ) : null}
          <FileInspector file={selectedFile} />
        </div>
      </section>
    </div>
  );
}

"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { buildCodeCityLayout } from "@/lib/movie/layout";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";

type CodeCityCanvasProps = {
  movie: RepoMovie;
  frameIndex: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
};

export const CodeCityCanvas = forwardRef<HTMLCanvasElement, CodeCityCanvasProps>(function CodeCityCanvas(
  { movie, frameIndex, selectedPath, onSelectFile },
  forwardedRef
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);
  const frame = movie.frames[Math.min(frameIndex, movie.frames.length - 1)] ?? movie.frames[0];
  const currentCommit = movie.commits[Math.min(frameIndex, movie.commits.length - 1)];
  const currentEvents = useMemo(
    () => new Map(movie.events.filter((event) => event.commitSha === currentCommit?.sha).map((event) => [event.filePath, event])),
    [currentCommit?.sha, movie.events]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const layout = buildCodeCityLayout(movie, rect.width, rect.height);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#0b0d10";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const grid = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    grid.addColorStop(0, "rgba(250, 204, 21, 0.08)");
    grid.addColorStop(0.52, "rgba(20, 184, 166, 0.07)");
    grid.addColorStop(1, "rgba(244, 63, 94, 0.05)");
    ctx.fillStyle = grid;
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (const district of layout.districts) {
      ctx.fillStyle = district.color;
      ctx.strokeStyle = "rgba(214, 211, 209, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(district.x, district.y, district.width, district.height, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(231, 229, 228, 0.55)";
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillText(district.label, district.x + 12, district.y + 16);
    }

    const waveRadius = 42 + frame.intensity * 120;
    const waveX = rect.width * 0.52;
    const waveY = rect.height * 0.58;
    const wave = ctx.createRadialGradient(waveX, waveY, 4, waveX, waveY, waveRadius);
    wave.addColorStop(0, "rgba(250, 204, 21, 0.18)");
    wave.addColorStop(1, "rgba(250, 204, 21, 0)");
    ctx.fillStyle = wave;
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (const building of layout.buildings) {
      const frameFile = frame.files[building.path];
      const event = currentEvents.get(building.path);
      const isVisible = Boolean(frameFile);
      const isRecent = Boolean(frameFile?.recentChange);
      const isSelected = selectedPath === building.path;
      const status = event?.status;
      const grow = status === "added" ? 0.72 : 1;
      const fade = isVisible ? 1 : 0.16;
      const pulse = isRecent ? 1 + frame.intensity * 0.16 : 1;
      const height = building.height * grow * pulse;
      const y = building.y + building.height - height;

      ctx.save();
      ctx.globalAlpha = fade;
      if (isRecent || isSelected) {
        ctx.shadowColor = isSelected ? "#facc15" : building.color;
        ctx.shadowBlur = isSelected ? 18 : 12 + building.activityScore * 20;
      }
      ctx.fillStyle = building.color;
      ctx.beginPath();
      ctx.roundRect(building.x, y, building.width, height, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(building.x + 3, y + 5, Math.max(3, building.width - 6), 2);
      ctx.restore();

      if (status === "removed") {
        ctx.strokeStyle = "rgba(248, 113, 113, 0.72)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(building.x, y);
        ctx.lineTo(building.x + building.width, y + height);
        ctx.stroke();
      }
    }
  }, [canvasRef, currentEvents, frame, movie, selectedPath]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full min-h-[22rem] w-full rounded-md border border-stone-800 bg-stone-950"
      onClick={(event) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const layout = buildCodeCityLayout(movie, rect.width, rect.height);
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const hit = [...layout.buildings]
          .reverse()
          .find((building) => x >= building.x && x <= building.x + building.width && y >= building.y && y <= building.y + building.height);
        if (hit) {
          onSelectFile(hit.path);
        }
      }}
    />
  );
});

"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { buildCodeCityLayout } from "@/lib/movie/layout";
import type { RepoMovie } from "@/lib/movie/repo-movie-types";

type CodeCityCanvasProps = {
  movie: RepoMovie;
  frameIndex: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
};

const canvasFallbackBackground = {
  backgroundColor: "#080b0d",
  backgroundImage: [
    "linear-gradient(135deg, rgba(20, 184, 166, 0.16), rgba(250, 204, 21, 0.1) 48%, rgba(244, 63, 94, 0.1))",
    "linear-gradient(to top, rgba(96, 165, 250, 0.34) 0 58%, transparent 58%)",
    "linear-gradient(to top, rgba(245, 245, 244, 0.3) 0 44%, transparent 44%)",
    "linear-gradient(to top, rgba(37, 99, 235, 0.34) 0 72%, transparent 72%)",
    "linear-gradient(to top, rgba(20, 184, 166, 0.26) 0 38%, transparent 38%)",
    "linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)",
    "linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px)"
  ].join(", "),
  backgroundPosition: "0 0, 12% bottom, 28% bottom, 54% bottom, 74% bottom, 0 0, 0 0",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 100%, 7% 72%, 8% 62%, 9% 82%, 7% 56%, 34px 34px, 34px 34px"
};

function hexToRgb(color: string) {
  const hex = color.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((value) => value + value).join("") : hex;
  const value = Number.parseInt(normalized, 16);

  if (Number.isNaN(value)) {
    return { r: 148, g: 163, b: 184 };
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgba(color: string, alpha: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(color: string, factor: number) {
  const { r, g, b } = hexToRgb(color);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `rgb(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)})`;
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
}

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

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const drawingCanvas = canvas;
    const drawingContext = ctx;
    let animationFrame = 0;

    function draw(now: number) {
      const rect = drawingCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
      const nextHeight = Math.max(1, Math.floor(rect.height * dpr));

      if (drawingCanvas.width !== nextWidth || drawingCanvas.height !== nextHeight) {
        drawingCanvas.width = nextWidth;
        drawingCanvas.height = nextHeight;
      }

      const ctx = drawingContext;
      const width = rect.width;
      const height = rect.height;
      const tempo = now / 1000;
      const layout = buildCodeCityLayout(movie, width, height);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const sky = ctx.createLinearGradient(0, 0, width, height);
      sky.addColorStop(0, "#080b0d");
      sky.addColorStop(0.44, "#10140f");
      sky.addColorStop(1, "#070809");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const scan = ctx.createLinearGradient(0, 0, width, 0);
      scan.addColorStop(0, "rgba(20, 184, 166, 0.12)");
      scan.addColorStop(0.5, "rgba(250, 204, 21, 0.09)");
      scan.addColorStop(1, "rgba(244, 63, 94, 0.08)");
      ctx.fillStyle = scan;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "rgba(231, 229, 228, 0.16)";
      ctx.lineWidth = 1;
      for (let x = -height; x < width + height; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x + height * 0.72, 0);
        ctx.stroke();
      }
      for (let x = -height; x < width + height; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * 0.72, height);
        ctx.stroke();
      }
      ctx.restore();

      const waveRadius = 90 + frame.intensity * 170 + (Math.sin(tempo * 2.2) + 1) * 24;
      const waveX = width * (0.42 + Math.sin(frame.index * 0.72) * 0.14);
      const waveY = height * (0.56 + Math.cos(frame.index * 0.52) * 0.1);
      const wave = ctx.createRadialGradient(waveX, waveY, 8, waveX, waveY, waveRadius);
      wave.addColorStop(0, `rgba(250, 204, 21, ${0.14 + frame.intensity * 0.12})`);
      wave.addColorStop(0.48, "rgba(20, 184, 166, 0.06)");
      wave.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = wave;
      ctx.fillRect(0, 0, width, height);

      for (const district of layout.districts) {
        const inset = 10;
        const ground = ctx.createLinearGradient(
          district.x,
          district.y,
          district.x + district.width,
          district.y + district.height
        );
        ground.addColorStop(0, "rgba(24, 31, 28, 0.96)");
        ground.addColorStop(0.55, district.color);
        ground.addColorStop(1, "rgba(10, 12, 13, 0.98)");

        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
        ctx.beginPath();
        ctx.roundRect(district.x + 8, district.y + 10, district.width, district.height, 12);
        ctx.fill();

        ctx.fillStyle = ground;
        ctx.strokeStyle = "rgba(250, 204, 21, 0.13)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(district.x, district.y, district.width, district.height, 12);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
        ctx.lineWidth = 1;
        for (let x = district.x + inset; x < district.x + district.width - inset; x += 26) {
          ctx.beginPath();
          ctx.moveTo(x, district.y + 32);
          ctx.lineTo(x + district.height * 0.18, district.y + district.height - inset);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(245, 245, 244, 0.62)";
        ctx.font = "700 10px ui-monospace, monospace";
        ctx.fillText(district.label.toUpperCase(), district.x + 14, district.y + 18);
      }

      const buildings = [...layout.buildings].sort((a, b) => a.y + a.height - (b.y + b.height));

      for (const building of buildings) {
        const frameFile = frame.files[building.path];
        const event = currentEvents.get(building.path);
        const isVisible = Boolean(frameFile);
        const isRecent = Boolean(frameFile?.recentChange);
        const isSelected = selectedPath === building.path;
        const status = event?.status;
        const fade = isVisible ? 1 : 0.14;
        const changePulse = isRecent ? 0.88 + Math.sin(tempo * 5.5 + building.x * 0.02) * 0.12 : 1;
        const grow = status === "added" ? 0.72 + Math.abs(Math.sin(tempo * 2.8)) * 0.2 : 1;
        const towerHeight = Math.max(16, building.height * grow * changePulse);
        const baseX = building.x;
        const baseY = building.y + building.height;
        const width2d = building.width;
        const depth = Math.max(10, Math.min(24, width2d * 0.62));
        const skew = depth * 0.46;
        const topY = baseY - towerHeight;

        ctx.save();
        ctx.globalAlpha = fade;

        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        drawPolygon(ctx, [
          [baseX + depth * 0.8, baseY + 4],
          [baseX + width2d + depth * 2.2, baseY - skew + 4],
          [baseX + width2d + depth * 1.25, baseY + 9],
          [baseX - depth * 0.2, baseY + 10]
        ]);
        ctx.fill();

        if (isRecent || isSelected) {
          ctx.shadowColor = isSelected ? "#facc15" : building.color;
          ctx.shadowBlur = isSelected ? 28 : 16 + building.activityScore * 24;
        }

        drawPolygon(ctx, [
          [baseX + width2d, topY],
          [baseX + width2d + depth, topY - skew],
          [baseX + width2d + depth, baseY - skew],
          [baseX + width2d, baseY]
        ]);
        ctx.fillStyle = shade(building.color, 0.48);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(baseX, topY, width2d, towerHeight, Math.min(5, width2d / 4));
        ctx.fillStyle = shade(building.color, 0.74);
        ctx.fill();

        drawPolygon(ctx, [
          [baseX, topY],
          [baseX + depth, topY - skew],
          [baseX + width2d + depth, topY - skew],
          [baseX + width2d, topY]
        ]);
        ctx.fillStyle = shade(building.color, isSelected ? 1.55 : 1.22);
        ctx.fill();
        ctx.strokeStyle = rgba(building.color, isSelected ? 0.9 : 0.38);
        ctx.stroke();

        ctx.shadowBlur = 0;
        const windowRows = Math.max(2, Math.min(12, Math.floor(towerHeight / 12)));
        const windowCols = Math.max(1, Math.min(4, Math.floor(width2d / 8)));
        const windowAlpha = isRecent ? 0.48 + Math.abs(Math.sin(tempo * 4)) * 0.22 : 0.18 + building.activityScore * 0.24;
        ctx.fillStyle = isSelected ? "rgba(255, 251, 235, 0.72)" : `rgba(255, 251, 235, ${windowAlpha})`;
        for (let row = 0; row < windowRows; row += 1) {
          for (let col = 0; col < windowCols; col += 1) {
            const wx = baseX + 4 + col * ((width2d - 8) / windowCols);
            const wy = topY + 8 + row * ((towerHeight - 14) / windowRows);
            ctx.fillRect(wx, wy, Math.max(2, (width2d - 10) / windowCols - 3), 2);
          }
        }

        if (isRecent) {
          ctx.strokeStyle = rgba(building.color, 0.82);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(baseX + width2d / 2, topY - skew - 4);
          ctx.lineTo(baseX + width2d / 2, topY - skew - 15 - building.activityScore * 14);
          ctx.stroke();
          ctx.fillStyle = "rgba(250, 204, 21, 0.88)";
          ctx.beginPath();
          ctx.arc(baseX + width2d / 2, topY - skew - 16 - building.activityScore * 14, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (status === "removed") {
          ctx.strokeStyle = "rgba(248, 113, 113, 0.78)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(baseX, topY);
          ctx.lineTo(baseX + width2d + depth, baseY - skew);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.fillStyle = "rgba(245, 245, 244, 0.72)";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText(`${movie.repo.fullName} · frame ${frame.index + 1}/${movie.frames.length}`, 18, height - 18);

      animationFrame = window.requestAnimationFrame(draw);
    }

    draw(performance.now());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [canvasRef, currentEvents, frame, movie, selectedPath]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full min-h-[28rem] w-full rounded-[0.45rem] border border-stone-700/70 bg-stone-950 shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
      style={canvasFallbackBackground}
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
          .find((building) => {
            const depth = Math.max(10, Math.min(24, building.width * 0.62));
            return (
              x >= building.x &&
              x <= building.x + building.width + depth &&
              y >= building.y - depth &&
              y <= building.y + building.height
            );
          });
        if (hit) {
          onSelectFile(hit.path);
        }
      }}
    />
  );
});

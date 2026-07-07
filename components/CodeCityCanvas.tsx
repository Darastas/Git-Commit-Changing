"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import {
  buildCommitTrend,
  buildDynamicTrendScales,
  interpolateTrendPoint,
  nearestTrendPoint,
  type DynamicTrendScales,
  type CommitTrendPoint,
  type InterpolatedTrendPoint
} from "@/lib/movie/trend";
import type { MovieFile, RepoMovie } from "@/lib/movie/repo-movie-types";
import { messages, type AppLanguage } from "./language";

type CodeCityCanvasProps = {
  movie: RepoMovie;
  language: AppLanguage;
  playheadProgress: number;
  curveStyle: ChartCurveStyle;
  colorTheme: ChartColorTheme;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChartLayout = {
  chart: Rect;
  hud: Rect;
  small: boolean;
};

type ChartPoint = {
  x: number;
  y: number;
  source: CommitTrendPoint;
  index: number;
};

type ChangedFile = CommitTrendPoint["changedFiles"][number];
type CanvasCopy = Record<keyof typeof messages.en, string>;

export type ChartCurveStyle = "smooth" | "linear" | "dash";
export type ChartColorTheme = "geist" | "primer" | "linear" | "mono" | "sage";

type ChartPalette = {
  name: ChartColorTheme;
  background: [string, string, string];
  ambient: [string, string, string];
  commitStops: [string, string, string];
  starStops: [string, string, string];
  commitGlow: string;
  starGlow: string;
  cursor: string;
  cursorHalo: string;
  progressStops: [string, string, string];
  selectedFill: string;
  selectedStroke: string;
};

const CANVAS_MIN_RENDER_SCALE = 2;
const CANVAS_MAX_RENDER_SCALE = 3;
const MAX_CURVE_SAMPLES = 420;
const MAX_COMMIT_MARKERS = 120;
const MAX_STAR_MARKERS = 90;
const CANVAS_FONT_SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CANVAS_FONT_MONO = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

const CHART_PALETTES: Record<ChartColorTheme, ChartPalette> = {
  geist: {
    name: "geist",
    background: ["#050505", "#0a0a0a", "#111111"],
    ambient: ["rgba(255, 255, 255, 0.08)", "rgba(59, 130, 246, 0.055)", "rgba(255, 255, 255, 0)"],
    commitStops: ["#f5f5f5", "#93c5fd", "#a1a1aa"],
    starStops: ["rgba(148, 163, 184, 0.32)", "rgba(129, 140, 248, 0.72)", "rgba(226, 232, 240, 0.66)"],
    commitGlow: "#93c5fd",
    starGlow: "#818cf8",
    cursor: "#ffffff",
    cursorHalo: "rgba(147, 197, 253, 0.24)",
    progressStops: ["rgba(245, 245, 245, 0.34)", "rgba(147, 197, 253, 0.28)", "rgba(161, 161, 170, 0.26)"],
    selectedFill: "rgba(147, 197, 253, 0.1)",
    selectedStroke: "rgba(147, 197, 253, 0.26)"
  },
  primer: {
    name: "primer",
    background: ["#0d1117", "#111820", "#0b0f14"],
    ambient: ["rgba(88, 166, 255, 0.1)", "rgba(63, 185, 80, 0.055)", "rgba(210, 153, 34, 0)"],
    commitStops: ["#7ee787", "#58a6ff", "#c9d1d9"],
    starStops: ["rgba(88, 166, 255, 0.28)", "rgba(210, 153, 34, 0.7)", "rgba(201, 209, 217, 0.68)"],
    commitGlow: "#58a6ff",
    starGlow: "#d29922",
    cursor: "#f0f6fc",
    cursorHalo: "rgba(88, 166, 255, 0.24)",
    progressStops: ["rgba(126, 231, 135, 0.34)", "rgba(88, 166, 255, 0.28)", "rgba(201, 209, 217, 0.2)"],
    selectedFill: "rgba(88, 166, 255, 0.1)",
    selectedStroke: "rgba(88, 166, 255, 0.26)"
  },
  linear: {
    name: "linear",
    background: ["#09090b", "#111116", "#0c0c10"],
    ambient: ["rgba(94, 106, 210, 0.11)", "rgba(203, 213, 225, 0.045)", "rgba(244, 244, 245, 0)"],
    commitStops: ["#e4e4e7", "#9ca3ff", "#94a3b8"],
    starStops: ["rgba(148, 163, 184, 0.28)", "rgba(196, 181, 253, 0.66)", "rgba(226, 232, 240, 0.64)"],
    commitGlow: "#9ca3ff",
    starGlow: "#c4b5fd",
    cursor: "#fafafa",
    cursorHalo: "rgba(156, 163, 255, 0.24)",
    progressStops: ["rgba(228, 228, 231, 0.32)", "rgba(156, 163, 255, 0.28)", "rgba(148, 163, 184, 0.24)"],
    selectedFill: "rgba(156, 163, 255, 0.1)",
    selectedStroke: "rgba(156, 163, 255, 0.25)"
  },
  mono: {
    name: "mono",
    background: ["#080808", "#0f0f0f", "#090909"],
    ambient: ["rgba(250, 250, 250, 0.075)", "rgba(115, 115, 115, 0.04)", "rgba(250, 250, 250, 0)"],
    commitStops: ["#fafafa", "#d4d4d4", "#737373"],
    starStops: ["rgba(163, 163, 163, 0.26)", "rgba(212, 212, 212, 0.62)", "rgba(245, 245, 245, 0.58)"],
    commitGlow: "#d4d4d4",
    starGlow: "#a3a3a3",
    cursor: "#ffffff",
    cursorHalo: "rgba(212, 212, 212, 0.2)",
    progressStops: ["rgba(250, 250, 250, 0.3)", "rgba(212, 212, 212, 0.24)", "rgba(115, 115, 115, 0.22)"],
    selectedFill: "rgba(245, 245, 245, 0.08)",
    selectedStroke: "rgba(245, 245, 245, 0.2)"
  },
  sage: {
    name: "sage",
    background: ["#080b0a", "#101412", "#090c0b"],
    ambient: ["rgba(134, 239, 172, 0.085)", "rgba(186, 230, 253, 0.045)", "rgba(244, 114, 182, 0)"],
    commitStops: ["#d9f99d", "#86efac", "#bae6fd"],
    starStops: ["rgba(186, 230, 253, 0.26)", "rgba(134, 239, 172, 0.6)", "rgba(229, 231, 235, 0.62)"],
    commitGlow: "#86efac",
    starGlow: "#bae6fd",
    cursor: "#f7fee7",
    cursorHalo: "rgba(134, 239, 172, 0.22)",
    progressStops: ["rgba(217, 249, 157, 0.28)", "rgba(134, 239, 172, 0.26)", "rgba(186, 230, 253, 0.22)"],
    selectedFill: "rgba(134, 239, 172, 0.09)",
    selectedStroke: "rgba(134, 239, 172, 0.24)"
  }
};

const canvasFallbackBackground = {
  backgroundColor: "#090b0a",
  backgroundImage: [
    "linear-gradient(135deg, rgba(20, 184, 166, 0.16), rgba(250, 204, 21, 0.08) 48%, rgba(244, 63, 94, 0.1))",
    "linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)",
    "linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)"
  ].join(", "),
  backgroundPosition: "0 0, 0 0, 0 0",
  backgroundRepeat: "no-repeat, repeat, repeat",
  backgroundSize: "100% 100%, 34px 34px, 34px 34px"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCanvasRenderScale() {
  return clamp(window.devicePixelRatio || 1, CANVAS_MIN_RENDER_SCALE, CANVAS_MAX_RENDER_SCALE);
}

function formatAxisTimestamp(timestamp: number, spanMs: number) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  if (spanMs < 36 * 60 * 60 * 1000) {
    return value.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" });
  }

  if (spanMs > 365 * 24 * 60 * 60 * 1000) {
    return value.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatStars(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.max(0, Math.round(value)));
}

function formatWholeNumber(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString("en-US");
}

function formatHudDate(date: string, compact = false) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return date.slice(0, 10);
  }
  if (compact) {
    return value.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
  }
  return value.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const suffix = "...";
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}${suffix}`).width > maxWidth) {
    end -= 1;
  }
  return `${text.slice(0, Math.max(0, end)).trimEnd()}${suffix}`;
}

function drawFitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.fillText(fitText(ctx, text, maxWidth), x, y);
}

function setFittedFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  maxSize: number,
  minSize: number,
  family = CANVAS_FONT_SANS
) {
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      line = nextLine;
      continue;
    }

    if (line) {
      lines.push(line);
      line = word;
    } else {
      lines.push(word);
      line = "";
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  lines.slice(0, maxLines).forEach((lineText, index) => {
    drawFitText(ctx, lineText, x, y + index * lineHeight, maxWidth);
  });
}

function calculateLayout(width: number, height: number): ChartLayout {
  const small = width < 620;
  const margin = small ? 14 : 24;
  const gap = small ? 10 : 54;
  const chartLeft = small ? 36 : 64;
  const chartTop = small ? 36 : 52;
  const chartBottom = height - (small ? 52 : 70);
  const minChartWidth = small ? 128 : 260;
  let hudWidth = clamp(width * (small ? 0.36 : 0.28), small ? 132 : 220, small ? 172 : 330);

  if (width - margin - hudWidth - gap - chartLeft < minChartWidth) {
    hudWidth = Math.max(small ? 112 : 190, width - margin - gap - chartLeft - minChartWidth);
  }

  const hudX = width - margin - hudWidth;
  const chartRight = Math.max(chartLeft + minChartWidth, hudX - gap);
  const usableHeight = Math.max(220, chartBottom - chartTop);

  return {
    small,
    chart: {
      x: chartLeft,
      y: chartTop,
      width: chartRight - chartLeft,
      height: usableHeight
    },
    hud: {
      x: hudX,
      y: chartTop,
      width: hudWidth,
      height: usableHeight
    }
  };
}

function pointX(
  point: CommitTrendPoint,
  points: CommitTrendPoint[],
  chart: Rect,
  index: number,
  scales: DynamicTrendScales
) {
  if (points.length <= 1) {
    return chart.x + chart.width * 0.5;
  }

  if (scales.finalTimeEnd <= scales.finalTimeStart) {
    const maxVisibleIndex = Math.max(1, scales.commitMax - 1);
    return chart.x + (index / maxVisibleIndex) * chart.width;
  }

  const visibleSpan = Math.max(1, scales.timeEnd - scales.timeStart);
  return chart.x + ((point.timestamp - scales.timeStart) / visibleSpan) * chart.width;
}

function pointY(value: number, maxValue: number, chart: Rect) {
  const normalized = value / Math.max(1, maxValue);
  return chart.y + chart.height - normalized * chart.height;
}

function commitChartPoint(point: CommitTrendPoint, points: CommitTrendPoint[], chart: Rect, index: number, scales: DynamicTrendScales): ChartPoint {
  return {
    x: pointX(point, points, chart, index, scales),
    y: pointY(point.cumulativeCommits, scales.commitMax, chart),
    source: point,
    index
  };
}

function starChartPoint(point: CommitTrendPoint, points: CommitTrendPoint[], chart: Rect, index: number, scales: DynamicTrendScales): ChartPoint {
  return {
    x: pointX(point, points, chart, index, scales),
    y: pointY(point.cumulativeStars, Math.max(1, scales.starMax), chart),
    source: point,
    index
  };
}

function visibleEndIndex(points: CommitTrendPoint[], scales: DynamicTrendScales, forcedIndex: number) {
  let endIndex = Math.min(points.length - 1, Math.max(0, forcedIndex));
  while (endIndex + 1 < points.length && points[endIndex + 1].timestamp <= scales.timeEnd) {
    endIndex += 1;
  }
  return endIndex;
}

function buildSampledChartPoints(
  points: CommitTrendPoint[],
  chart: Rect,
  scales: DynamicTrendScales,
  endIndex: number,
  maxSamples: number,
  pointBuilder: (point: CommitTrendPoint, points: CommitTrendPoint[], chart: Rect, index: number, scales: DynamicTrendScales) => ChartPoint,
  forcedIndexes: number[] = []
) {
  if (points.length === 0) {
    return [];
  }

  const clampedEndIndex = Math.min(points.length - 1, Math.max(0, endIndex));
  const stride = Math.max(1, Math.ceil((clampedEndIndex + 1) / maxSamples));
  const indexSet = new Set<number>([0, clampedEndIndex]);
  for (let index = 0; index <= clampedEndIndex; index += stride) {
    indexSet.add(index);
  }
  forcedIndexes.forEach((index) => {
    if (index >= 0 && index <= clampedEndIndex) {
      indexSet.add(index);
    }
  });

  return Array.from(indexSet)
    .sort((a, b) => a - b)
    .map((index) => pointBuilder(points[index], points, chart, index, scales));
}

function curveControls(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lift = Math.min(28, Math.max(10, Math.abs(dx) * 0.09));

  return {
    c1: {
      x: from.x + dx * 0.42,
      y: from.y + dy * 0.08 - lift
    },
    c2: {
      x: to.x - dx * 0.34,
      y: to.y - dy * 0.08 + lift * 0.22
    }
  };
}

function cubicPoint(
  from: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  to: { x: number; y: number },
  progress: number
) {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * inverse * from.x +
      3 * inverse * inverse * progress * c1.x +
      3 * inverse * progress * progress * c2.x +
      progress * progress * progress * to.x,
    y:
      inverse * inverse * inverse * from.y +
      3 * inverse * inverse * progress * c1.y +
      3 * inverse * progress * progress * c2.y +
      progress * progress * progress * to.y
  };
}

function appendCurveSegments(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const { c1, c2 } = curveControls(from, to);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
  }
}

function appendPathSegments(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  curveStyle: ChartCurveStyle
) {
  if (curveStyle === "linear") {
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    return;
  }

  appendCurveSegments(ctx, points);
}

function drawChartPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  curveStyle: ChartCurveStyle
) {
  if (points.length === 0) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    return;
  }

  appendPathSegments(ctx, points, curveStyle);
}

function visualCursorPoint(
  points: CommitTrendPoint[],
  chart: Rect,
  scales: DynamicTrendScales,
  interpolated: InterpolatedTrendPoint,
  curveStyle: ChartCurveStyle,
  pointBuilder: (point: CommitTrendPoint, points: CommitTrendPoint[], chart: Rect, index: number, scales: DynamicTrendScales) => ChartPoint
) {
  if (points.length <= 1) {
    return points[0] ? pointBuilder(points[0], points, chart, 0, scales) : { x: 0, y: 0 };
  }

  const fromIndex = interpolated.segmentIndex;
  const toIndex = Math.min(points.length - 1, interpolated.segmentIndex + 1);
  const from = pointBuilder(points[fromIndex], points, chart, fromIndex, scales);
  const to = pointBuilder(points[toIndex], points, chart, toIndex, scales);
  if (curveStyle === "linear") {
    return {
      x: from.x + (to.x - from.x) * interpolated.segmentProgress,
      y: from.y + (to.y - from.y) * interpolated.segmentProgress
    };
  }

  const { c1, c2 } = curveControls(from, to);
  return cubicPoint(from, c1, c2, to, interpolated.segmentProgress);
}

function activeCommitForInterpolation(interpolated: InterpolatedTrendPoint) {
  return interpolated.segmentProgress >= 0.5 ? interpolated.right : interpolated.left;
}

function firstCommitMessageLine(message: string) {
  return message.split(/\r?\n/)[0]?.trim() || "(no commit message)";
}

function drawCursorAnnotation(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  cursor: { x: number; y: number },
  interpolated: InterpolatedTrendPoint,
  palette: ChartPalette,
  copy: CanvasCopy
) {
  const { chart, small } = layout;
  const boxWidth = clamp(chart.width * (small ? 0.76 : 0.42), small ? 148 : 220, small ? 216 : 320);
  const boxHeight = small ? 62 : 70;
  const edgePadding = 8;
  const activeCommit = activeCommitForInterpolation(interpolated);
  const trailingX = cursor.x - boxWidth - 14;
  const leadingX = cursor.x + 14;
  let x = trailingX >= chart.x + edgePadding ? trailingX : leadingX;
  x = clamp(x, chart.x + edgePadding, chart.x + chart.width - boxWidth - edgePadding);

  let y = cursor.y - boxHeight - 16;
  if (y < chart.y + edgePadding) {
    y = cursor.y + 16;
  }
  y = clamp(y, chart.y + edgePadding, chart.y + chart.height - boxHeight - edgePadding);

  const anchorX = x > cursor.x ? x : x + boxWidth;
  const anchorY = y + boxHeight * 0.55;

  ctx.save();
  ctx.strokeStyle = palette.selectedStroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursor.x, cursor.y);
  ctx.lineTo(anchorX, anchorY);
  ctx.stroke();

  ctx.fillStyle = "rgba(7, 9, 9, 0.82)";
  ctx.strokeStyle = palette.selectedStroke;
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.commitGlow;
  ctx.fillRect(x, y + 9, 2, boxHeight - 18);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${small ? 10 : 11}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  drawFitText(
    ctx,
    `${copy.commit} #${formatWholeNumber(interpolated.cumulativeCommits)} · ${formatHudDate(activeCommit.date, small)}`,
    x + 12,
    y + (small ? 18 : 20),
    boxWidth - 22
  );

  ctx.font = `600 ${small ? 10 : 11}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = palette.starStops[2];
  drawFitText(ctx, `${formatStars(interpolated.cumulativeStars)} ${copy.stars}`, x + 12, y + (small ? 35 : 40), boxWidth - 22);

  ctx.font = `600 ${small ? 10 : 11}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(214, 211, 209, 0.78)";
  drawFitText(ctx, firstCommitMessageLine(activeCommit.message), x + 12, y + (small ? 52 : 59), boxWidth - 22);
  ctx.restore();
}

function drawCanvasStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * (Math.PI / 5);
    const nextRadius = index % 2 === 0 ? radius : radius * 0.42;
    const nextX = x + Math.cos(angle) * nextRadius;
    const nextY = y + Math.sin(angle) * nextRadius;
    if (index === 0) {
      ctx.moveTo(nextX, nextY);
    } else {
      ctx.lineTo(nextX, nextY);
    }
  }
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, tempo: number, palette: ChartPalette) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, palette.background[0]);
  background.addColorStop(0.42, palette.background[1]);
  background.addColorStop(1, palette.background[2]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const ambient = ctx.createRadialGradient(width * 0.28, height * 0.2, 20, width * 0.28, height * 0.2, width * 0.72);
  ambient.addColorStop(0, palette.ambient[0]);
  ambient.addColorStop(0.46, palette.ambient[1]);
  ambient.addColorStop(1, palette.ambient[2]);
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "rgba(231, 229, 228, 0.18)";
  ctx.lineWidth = 1;
  const offset = (tempo * 12) % 34;
  for (let x = -34 + offset; x < width + 34; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = -34 + offset; y < height + 34; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  palette: ChartPalette,
  scales: DynamicTrendScales,
  copy: CanvasCopy
) {
  const { chart, small } = layout;
  const maxCommits = scales.commitMax;
  const maxStars = scales.starMax;

  ctx.save();
  ctx.fillStyle = "rgba(7, 9, 9, 0.34)";
  ctx.beginPath();
  ctx.roundRect(chart.x - 8, chart.y - 8, chart.width + 16, chart.height + 16, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(231, 229, 228, 0.16)";
  ctx.lineWidth = 1;
  ctx.font = `600 ${small ? 9 : 10}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(214, 211, 209, 0.62)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const yTicks = small ? 3 : 4;
  for (let tick = 0; tick <= yTicks; tick += 1) {
    const value = Math.round((maxCommits / yTicks) * tick);
    const y = chart.y + chart.height - (tick / yTicks) * chart.height;
    ctx.beginPath();
    ctx.moveTo(chart.x, y);
    ctx.lineTo(chart.x + chart.width, y);
    ctx.stroke();
    ctx.fillText(String(value), chart.x - 10, y);
  }

  if (maxStars > 0) {
    ctx.textAlign = small ? "right" : "left";
    ctx.fillStyle = palette.starStops[2];
    for (let tick = 0; tick <= yTicks; tick += 1) {
      const value = (maxStars / yTicks) * tick;
      const y = chart.y + chart.height - (tick / yTicks) * chart.height;
      ctx.fillText(formatStars(value), small ? chart.x + chart.width - 5 : chart.x + chart.width + 10, y);
    }

    ctx.strokeStyle = palette.starStops[1];
    ctx.globalAlpha = 0.52;
    ctx.beginPath();
    ctx.moveTo(chart.x + chart.width, chart.y);
    ctx.lineTo(chart.x + chart.width, chart.y + chart.height);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const tickCount = small ? 3 : 5;
  const timeSpan = Math.max(1, scales.timeEnd - scales.timeStart);
  for (let tick = 0; tick < tickCount; tick += 1) {
    const tickProgress = tick / (tickCount - 1);
    const x = chart.x + chart.width * tickProgress;
    const timestamp = scales.timeStart + timeSpan * tickProgress;
    ctx.strokeStyle = "rgba(231, 229, 228, 0.1)";
    ctx.beginPath();
    ctx.moveTo(x, chart.y);
    ctx.lineTo(x, chart.y + chart.height);
    ctx.stroke();
    ctx.fillStyle = "rgba(214, 211, 209, 0.62)";
    if (small && tick === 0) {
      ctx.textAlign = "left";
    } else if (small && tick === tickCount - 1) {
      ctx.textAlign = "right";
    } else {
      ctx.textAlign = "center";
    }
    ctx.fillText(formatAxisTimestamp(timestamp, timeSpan), x, chart.y + chart.height + 14);
  }

  ctx.strokeStyle = "rgba(245, 245, 244, 0.34)";
  ctx.beginPath();
  ctx.moveTo(chart.x, chart.y);
  ctx.lineTo(chart.x, chart.y + chart.height);
  ctx.lineTo(chart.x + chart.width, chart.y + chart.height);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${small ? 10 : 12}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(245, 245, 244, 0.9)";
  ctx.fillText(small ? copy.commits : copy.cumulativeCommits, chart.x, chart.y - 18);
  if (!small) {
    ctx.font = `600 10px ${CANVAS_FONT_SANS}`;
    ctx.fillStyle = "rgba(214, 211, 209, 0.58)";
    ctx.fillText(copy.datesWithCommits, chart.x + 152, chart.y - 18);
  }
  if (maxStars > 0) {
    const legendX = chart.x + chart.width - (small ? 60 : 132);
    ctx.strokeStyle = palette.starStops[1];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX, chart.y - 21);
    ctx.lineTo(legendX + 20, chart.y - 21);
    ctx.stroke();
    ctx.fillStyle = palette.starStops[2];
    ctx.fillText(small ? copy.stars : `${copy.starScale} ${formatStars(maxStars)}`, legendX + 26, chart.y - 18);
  }
  ctx.restore();
}

function drawTrendCurve(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  points: CommitTrendPoint[],
  progress: number,
  tempo: number,
  palette: ChartPalette,
  curveStyle: ChartCurveStyle,
  scales: DynamicTrendScales,
  copy: CanvasCopy
) {
  const { chart } = layout;
  const interpolated = interpolateTrendPoint(points, progress);
  if (!interpolated) {
    return undefined;
  }
  const visibleIndex = visibleEndIndex(points, scales, Math.min(points.length - 1, interpolated.segmentIndex + 1));
  const coordinates = buildSampledChartPoints(points, chart, scales, visibleIndex, MAX_CURVE_SAMPLES, commitChartPoint, [
    interpolated.segmentIndex,
    Math.min(points.length - 1, interpolated.segmentIndex + 1)
  ]);
  const cursor = visualCursorPoint(points, chart, scales, interpolated, curveStyle, commitChartPoint);
  const revealed = buildSampledChartPoints(points, chart, scales, interpolated.segmentIndex, MAX_CURVE_SAMPLES, commitChartPoint, [
    interpolated.segmentIndex
  ]);
  const last = revealed[revealed.length - 1];
  if (!last || Math.abs(last.x - cursor.x) > 0.01 || Math.abs(last.y - cursor.y) > 0.01) {
    revealed.push({ x: cursor.x, y: cursor.y, source: interpolated.right, index: Math.min(points.length - 1, interpolated.segmentIndex + 1) });
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.rect(chart.x, chart.y, chart.width, chart.height);
  ctx.clip();
  if (curveStyle === "dash") {
    ctx.setLineDash([9, 11]);
  }

  ctx.strokeStyle = "rgba(245, 245, 244, 0.18)";
  ctx.lineWidth = 1.6;
  drawChartPath(ctx, coordinates, curveStyle);
  ctx.stroke();

  ctx.setLineDash([]);
  if (revealed.length > 0) {
    const area = ctx.createLinearGradient(0, chart.y, 0, chart.y + chart.height);
    area.addColorStop(0, `${palette.commitStops[0]}33`);
    area.addColorStop(0.55, `${palette.commitStops[1]}16`);
    area.addColorStop(1, `${palette.commitStops[2]}08`);

    ctx.beginPath();
    ctx.moveTo(revealed[0].x, chart.y + chart.height);
    ctx.lineTo(revealed[0].x, revealed[0].y);
    appendPathSegments(ctx, revealed, curveStyle);
    ctx.lineTo(revealed[revealed.length - 1].x, chart.y + chart.height);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    const stroke = ctx.createLinearGradient(chart.x, 0, chart.x + chart.width, 0);
    stroke.addColorStop(0, palette.commitStops[0]);
    stroke.addColorStop(0.52, palette.commitStops[1]);
    stroke.addColorStop(1, palette.commitStops[2]);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = curveStyle === "dash" ? 3 : 3.4;
    ctx.shadowColor = palette.commitGlow;
    ctx.shadowBlur = curveStyle === "linear" ? 10 : 16 + Math.sin(tempo * 2.4) * 4;
    if (curveStyle === "dash") {
      ctx.setLineDash([13, 9]);
      ctx.lineDashOffset = -tempo * 18;
    }
    drawChartPath(ctx, revealed, curveStyle);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 251, 235, 0.74)";
    ctx.lineWidth = 1.1;
    drawChartPath(ctx, revealed, curveStyle);
    ctx.stroke();
  }

  const commitMarkerStride = Math.max(1, Math.ceil(coordinates.length / MAX_COMMIT_MARKERS));
  coordinates.forEach((point, arrayIndex) => {
    if (
      arrayIndex % commitMarkerStride !== 0 &&
      point.index !== coordinates[coordinates.length - 1]?.index &&
      point.index !== interpolated.segmentIndex
    ) {
      return;
    }
    const reached = point.index <= interpolated.segmentIndex || point.x <= cursor.x;
    ctx.beginPath();
    ctx.arc(point.x, point.y, reached ? 4.2 : 3, 0, Math.PI * 2);
    ctx.fillStyle = reached ? "rgba(255, 251, 235, 0.92)" : "rgba(168, 162, 158, 0.34)";
    ctx.fill();
    ctx.strokeStyle = reached ? palette.commitGlow : "rgba(231, 229, 228, 0.16)";
    ctx.stroke();
  });

  const pulse = 1 + Math.sin(tempo * 4.8) * 0.12;
  ctx.strokeStyle = palette.cursorHalo;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursor.x, chart.y);
  ctx.lineTo(cursor.x, chart.y + chart.height);
  ctx.stroke();

  const halo = ctx.createRadialGradient(cursor.x, cursor.y, 2, cursor.x, cursor.y, 34 * pulse);
  halo.addColorStop(0, "rgba(255, 251, 235, 0.82)");
  halo.addColorStop(0.26, palette.cursorHalo);
  halo.addColorStop(1, `${palette.commitGlow}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.cursor;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 5.2, 0, Math.PI * 2);
  ctx.fill();

  for (let trail = 1; trail <= 3; trail += 1) {
    const trailProgress = clamp(progress - trail * 0.045, 0, 1);
    const trailing = interpolateTrendPoint(points, trailProgress);
    if (!trailing) {
      continue;
    }
    const trailingPoint = visualCursorPoint(points, chart, scales, trailing, curveStyle, commitChartPoint);
    ctx.fillStyle = `${palette.commitStops[0]}${Math.round((0.22 - trail * 0.045) * 255)
      .toString(16)
      .padStart(2, "0")}`;
    ctx.beginPath();
    ctx.arc(trailingPoint.x, trailingPoint.y, 6 - trail, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  drawCursorAnnotation(ctx, layout, cursor, interpolated, palette, copy);
  return interpolated;
}

function drawStarTrendCurve(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  points: CommitTrendPoint[],
  progress: number,
  tempo: number,
  palette: ChartPalette,
  curveStyle: ChartCurveStyle,
  scales: DynamicTrendScales
) {
  const totalStars = scales.finalStarMax;
  if (totalStars <= 0) {
    return;
  }

  const { chart } = layout;
  const interpolated = interpolateTrendPoint(points, progress);
  if (!interpolated) {
    return;
  }

  const visibleIndex = visibleEndIndex(points, scales, Math.min(points.length - 1, interpolated.segmentIndex + 1));
  const coordinates = buildSampledChartPoints(points, chart, scales, visibleIndex, MAX_CURVE_SAMPLES, starChartPoint, [
    interpolated.segmentIndex,
    Math.min(points.length - 1, interpolated.segmentIndex + 1)
  ]);
  const cursor = visualCursorPoint(points, chart, scales, interpolated, curveStyle, starChartPoint);
  const revealed = buildSampledChartPoints(points, chart, scales, interpolated.segmentIndex, MAX_CURVE_SAMPLES, starChartPoint, [
    interpolated.segmentIndex
  ]);
  const last = revealed[revealed.length - 1];
  if (!last || Math.abs(last.x - cursor.x) > 0.01 || Math.abs(last.y - cursor.y) > 0.01) {
    revealed.push({ x: cursor.x, y: cursor.y, source: interpolated.right, index: Math.min(points.length - 1, interpolated.segmentIndex + 1) });
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.rect(chart.x, chart.y, chart.width, chart.height);
  ctx.clip();
  if (curveStyle === "dash") {
    ctx.setLineDash([7, 8]);
  }

  ctx.strokeStyle = "rgba(125, 211, 252, 0.18)";
  ctx.lineWidth = 1.3;
  drawChartPath(ctx, coordinates, curveStyle);
  ctx.stroke();
  ctx.setLineDash([]);

  const stroke = ctx.createLinearGradient(chart.x, 0, chart.x + chart.width, 0);
  stroke.addColorStop(0, palette.starStops[0]);
  stroke.addColorStop(0.5, palette.starStops[1]);
  stroke.addColorStop(1, palette.starStops[2]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = curveStyle === "linear" ? 1.8 : 2.2;
  ctx.shadowColor = palette.starGlow;
  ctx.shadowBlur = curveStyle === "linear" ? 7 : 12 + Math.sin(tempo * 2.1) * 3;
  if (curveStyle === "dash") {
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -tempo * 12;
  }
  drawChartPath(ctx, revealed, curveStyle);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowBlur = 0;
  const starMarkerStride = Math.max(1, Math.ceil(coordinates.length / MAX_STAR_MARKERS));
  coordinates.forEach((point, arrayIndex) => {
    if (
      arrayIndex % starMarkerStride !== 0 &&
      point.index !== coordinates[coordinates.length - 1]?.index &&
      point.index !== interpolated.segmentIndex
    ) {
      return;
    }
    const reached = point.index <= interpolated.segmentIndex || point.x <= cursor.x;
    ctx.fillStyle = reached ? "rgba(186, 230, 253, 0.86)" : "rgba(125, 211, 252, 0.24)";
    drawCanvasStar(ctx, point.x, point.y, reached ? 4.2 : 3.2);
    ctx.fill();
  });

  const halo = ctx.createRadialGradient(cursor.x, cursor.y, 2, cursor.x, cursor.y, 24);
  halo.addColorStop(0, "rgba(255, 255, 255, 0.76)");
  halo.addColorStop(0.42, palette.starStops[1]);
  halo.addColorStop(1, `${palette.starGlow}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(240, 249, 255, 0.96)";
  drawCanvasStar(ctx, cursor.x, cursor.y, 6.2);
  ctx.fill();
  ctx.restore();
}

function drawHudMetric(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  ctx.font = `700 10px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(168, 162, 158, 0.82)";
  ctx.fillText(label.toUpperCase(), x, y);
  setFittedFont(ctx, value, width, 800, 13, 10);
  ctx.fillStyle = "rgba(255, 251, 235, 0.92)";
  drawFitText(ctx, value, x, y + 16, width);
}

function fileStatusColor(status: string) {
  if (status === "added") {
    return "#34d399";
  }
  if (status === "removed") {
    return "#fb7185";
  }
  if (status === "renamed") {
    return "#fbbf24";
  }
  return "#38bdf8";
}

function compactFilePath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `${parts.at(-2)}/${parts.at(-1)}`;
}

function displayFilePath(path: string, small: boolean) {
  if (!small) {
    return compactFilePath(path);
  }
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function drawCircularAvatar(
  ctx: CanvasRenderingContext2D,
  point: CommitTrendPoint,
  avatarImages: Map<string, HTMLImageElement>,
  x: number,
  y: number,
  radius: number,
  tempo: number,
  palette: ChartPalette
) {
  const image = point.authorAvatar ? avatarImages.get(point.authorAvatar) : undefined;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();

  if (image?.complete && image.naturalWidth > 0) {
    const scale = Math.max((radius * 2) / image.naturalWidth, (radius * 2) / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  } else {
    const avatarGradient = ctx.createRadialGradient(x - radius * 0.34, y - radius * 0.34, 2, x, y, radius + 10);
    avatarGradient.addColorStop(0, "rgba(255, 251, 235, 0.98)");
    avatarGradient.addColorStop(0.46, palette.commitStops[1]);
    avatarGradient.addColorStop(1, palette.commitStops[0]);
    ctx.fillStyle = avatarGradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#090b0a";
    ctx.font = `900 ${Math.max(14, radius * 0.7)}px ${CANVAS_FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsFor(point.authorName), x, y + 1);
  }
  ctx.restore();

  ctx.strokeStyle = `rgba(255, 251, 235, ${0.42 + Math.sin(tempo * 3.2) * 0.08})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawChangedFilesList(
  ctx: CanvasRenderingContext2D,
  files: ChangedFile[],
  selectedPath: string | undefined,
  x: number,
  y: number,
  width: number,
  maxY: number,
  small: boolean,
  palette: ChartPalette,
  copy: CanvasCopy
) {
  const rowHeight = small ? 26 : 30;
  const gap = small ? 5 : 6;
  const visibleCount = Math.max(0, Math.min(files.length, Math.floor((maxY - y - 18) / (rowHeight + gap)), small ? 3 : 5));
  if (visibleCount <= 0) {
    return y;
  }

  const selectedChangedFile = files.find((file) => file.path === selectedPath) ?? files[0];
  ctx.font = `800 ${small ? 10 : 11}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(245, 245, 244, 0.86)";
  ctx.fillText(copy.changedFiles, x, y);
  ctx.font = `700 ${small ? 10 : 11}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(168, 162, 158, 0.78)";
  ctx.textAlign = "right";
  ctx.fillText(String(files.length), x + width, y);
  ctx.textAlign = "left";
  y += small ? 12 : 14;

  files.slice(0, visibleCount).forEach((file) => {
    const active = file.path === selectedChangedFile.path;
    ctx.fillStyle = active ? palette.selectedFill : "rgba(9, 11, 10, 0.58)";
    ctx.strokeStyle = active ? palette.selectedStroke : "rgba(68, 64, 60, 0.72)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, rowHeight, 7);
    ctx.fill();
    ctx.stroke();

    const statusColor = fileStatusColor(file.status);
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(x + 10, y + rowHeight / 2, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `800 ${small ? 10 : 11}px ${CANVAS_FONT_SANS}`;
    ctx.fillStyle = active ? "rgba(240, 253, 250, 0.95)" : "rgba(231, 229, 228, 0.86)";
    drawFitText(ctx, displayFilePath(file.path, small), x + 19, y + rowHeight / 2 + 4, width - (small ? 58 : 72));

    ctx.textAlign = "right";
    ctx.font = `800 ${small ? 9 : 10}px ${CANVAS_FONT_SANS}`;
    ctx.fillStyle = "rgba(214, 211, 209, 0.72)";
    ctx.fillText(String(file.changes), x + width - 9, y + rowHeight / 2 + 4);
    ctx.textAlign = "left";
    y += rowHeight + gap;
  });

  const hidden = files.length - visibleCount;
  if (hidden > 0 && y + 14 <= maxY) {
    ctx.font = `700 ${small ? 9 : 10}px ${CANVAS_FONT_SANS}`;
    ctx.fillStyle = "rgba(168, 162, 158, 0.68)";
    ctx.fillText(`+${hidden} ${copy.moreFiles}`, x + 2, y + 8);
  }

  return y;
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  movie: RepoMovie,
  point: CommitTrendPoint,
  selectedFile: MovieFile | undefined,
  progress: number,
  tempo: number,
  palette: ChartPalette,
  avatarImages: Map<string, HTMLImageElement>,
  copy: CanvasCopy
) {
  const { hud, small } = layout;
  const padding = small ? 12 : 16;
  const contentWidth = hud.width - padding * 2;
  const current = point.cumulativeCommits;
  const total = Math.max(1, movie.commits.length);

  ctx.save();
  ctx.fillStyle = "rgba(12, 14, 12, 0.82)";
  ctx.strokeStyle = "rgba(245, 245, 244, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(hud.x, hud.y, hud.width, hud.height, 10);
  ctx.fill();
  ctx.stroke();

  const progressHeight = Math.max(3, hud.height * progress);
  const progressGradient = ctx.createLinearGradient(0, hud.y + hud.height, 0, hud.y);
  progressGradient.addColorStop(0, palette.progressStops[0]);
  progressGradient.addColorStop(0.52, palette.progressStops[1]);
  progressGradient.addColorStop(1, palette.progressStops[2]);
  ctx.fillStyle = progressGradient;
  ctx.fillRect(hud.x, hud.y + hud.height - progressHeight, 3, progressHeight);

  const x = hud.x + padding;
  let y = hud.y + padding;
  const avatarRadius = small ? 21 : 27;
  const avatarX = x + avatarRadius;
  const avatarY = y + avatarRadius;
  drawCircularAvatar(ctx, point, avatarImages, avatarX, avatarY, avatarRadius, tempo, palette);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const nameX = avatarX + avatarRadius + 10;
  const nameWidth = hud.x + hud.width - padding - nameX;
  ctx.font = `800 ${small ? 14 : 16}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(255, 251, 235, 0.94)";
  drawFitText(ctx, point.authorName, nameX, y + avatarRadius - 1, nameWidth);
  ctx.font = `700 ${small ? 11 : 12}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(168, 162, 158, 0.88)";
  drawFitText(ctx, point.authorLogin ? `@${point.authorLogin}` : point.shortSha, nameX, y + avatarRadius + 16, nameWidth);

  y += avatarRadius * 2 + (small ? 18 : 24);

  const currentText = formatWholeNumber(current);
  const totalText = `/ ${formatWholeNumber(total)} ${copy.commits}`;
  const countBaseline = y + (small ? 24 : 32);
  setFittedFont(ctx, currentText, contentWidth, 900, small ? 28 : 36, small ? 20 : 26);
  ctx.fillStyle = "rgba(255, 251, 235, 0.98)";
  ctx.fillText(currentText, x, countBaseline);
  const currentWidth = ctx.measureText(currentText).width;
  ctx.font = `800 ${small ? 11 : 13}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = palette.commitStops[1];
  const totalX = x + currentWidth + (small ? 8 : 10);
  if (totalX + ctx.measureText(totalText).width <= x + contentWidth) {
    ctx.fillText(totalText, totalX, countBaseline - (small ? 1 : 2));
    y += small ? 48 : 60;
  } else {
    drawFitText(ctx, totalText, x, countBaseline + (small ? 17 : 20), contentWidth);
    y += small ? 62 : 76;
  }

  ctx.font = `800 ${small ? 13 : 15}px ${CANVAS_FONT_SANS}`;
  ctx.fillStyle = "rgba(245, 245, 244, 0.92)";
  wrapText(ctx, point.message || copy.untitledCommit, x, y, contentWidth, small ? 16 : 19, small ? 2 : 3);
  y += small ? 46 : 60;

  const columnGap = small ? 8 : 12;
  const metricWidth = (contentWidth - columnGap) / 2;
  drawHudMetric(ctx, copy.date, formatHudDate(point.date, small), x, y, metricWidth);
  drawHudMetric(ctx, copy.files, String(point.changedFiles.length), x + metricWidth + columnGap, y, metricWidth);
  y += small ? 36 : 50;
  drawHudMetric(ctx, copy.delta, small ? `+${point.additions}/-${point.deletions}` : `+${point.additions} / -${point.deletions}`, x, y, metricWidth);
  drawHudMetric(ctx, copy.stars, formatStars(point.cumulativeStars), x + metricWidth + columnGap, y, metricWidth);
  y += small ? 38 : 56;

  if (y < hud.y + hud.height - 92) {
    ctx.font = `700 10px ${CANVAS_FONT_SANS}`;
    ctx.fillStyle = "rgba(168, 162, 158, 0.76)";
    ctx.fillText("SHA", x, y - 6);
    ctx.font = `800 ${small ? 10 : 11}px ${CANVAS_FONT_MONO}`;
    ctx.fillStyle = "rgba(214, 211, 209, 0.86)";
    drawFitText(ctx, point.shortSha, x + 28, y - 6, contentWidth - 28);
    y += small ? 18 : 20;
  }

  const fileListY =
    point.changedFiles.length > 0 ? Math.min(y, hud.y + hud.height - (small ? 76 : 124)) : y;
  drawChangedFilesList(ctx, point.changedFiles, selectedFile?.path, x, fileListY, contentWidth, hud.y + hud.height - 14, small, palette, copy);

  ctx.restore();
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number, copy: CanvasCopy) {
  drawBackground(ctx, width, height, 0, CHART_PALETTES.geist);
  ctx.save();
  ctx.fillStyle = "rgba(245, 245, 244, 0.86)";
  ctx.font = `800 16px ${CANVAS_FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(copy.noCommitData, width / 2, height / 2);
  ctx.restore();
}

export const CodeCityCanvas = forwardRef<HTMLCanvasElement, CodeCityCanvasProps>(function CodeCityCanvas(
  { movie, language, playheadProgress, curveStyle, colorTheme, selectedPath, onSelectFile },
  forwardedRef
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);
  const trend = useMemo(() => buildCommitTrend(movie), [movie]);
  const palette = CHART_PALETTES[colorTheme];
  const copy = messages[language];
  const selectedFile = selectedPath ? movie.files[selectedPath] : undefined;

  useEffect(() => {
    const cache = avatarImagesRef.current;
    const avatarUrls = new Set(trend.map((point) => point.authorAvatar).filter((avatar): avatar is string => Boolean(avatar)));
    avatarUrls.forEach((avatarUrl) => {
      if (cache.has(avatarUrl)) {
        return;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.src = avatarUrl;
      cache.set(avatarUrl, image);
    });
  }, [trend]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
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
      const renderScale = getCanvasRenderScale();
      const nextWidth = Math.max(1, Math.ceil(rect.width * renderScale));
      const nextHeight = Math.max(1, Math.ceil(rect.height * renderScale));

      if (drawingCanvas.width !== nextWidth || drawingCanvas.height !== nextHeight) {
        drawingCanvas.width = nextWidth;
        drawingCanvas.height = nextHeight;
      }

      const ctx = drawingContext;
      const width = rect.width;
      const height = rect.height;
      const tempo = now / 1000;

      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (trend.length === 0) {
        drawEmptyState(ctx, width, height, copy);
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      const layout = calculateLayout(width, height);
      const progress = trend.length <= 1 ? 1 : clamp(playheadProgress, 0, 1);
      const scales = buildDynamicTrendScales(trend, progress);
      const activePoint = nearestTrendPoint(trend, progress) ?? trend[0];

      drawBackground(ctx, width, height, tempo, palette);
      drawAxes(ctx, layout, palette, scales, copy);
      drawStarTrendCurve(ctx, layout, trend, progress, tempo, palette, curveStyle, scales);
      drawTrendCurve(ctx, layout, trend, progress, tempo, palette, curveStyle, scales, copy);
      drawHud(ctx, layout, movie, activePoint, selectedFile, progress, tempo, palette, avatarImagesRef.current, copy);

      ctx.save();
      ctx.font = `700 11px ${CANVAS_FONT_SANS}`;
      ctx.fillStyle = "rgba(214, 211, 209, 0.72)";
      ctx.fillText(`${movie.repo.fullName} / ${movie.repo.defaultBranch}`, 18, height - 18);
      ctx.restore();

      animationFrame = window.requestAnimationFrame(draw);
    }

    draw(performance.now());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [copy, movie, playheadProgress, selectedFile, trend, palette, curveStyle]);

  return (
    <canvas
      ref={canvasRef}
      className="aspect-[16/9] min-h-[26rem] w-full rounded-[0.45rem] border border-stone-700/70 bg-stone-950 shadow-[0_18px_60px_rgba(0,0,0,0.42)] sm:min-h-[28rem] lg:min-h-[30rem]"
      style={canvasFallbackBackground}
      onClick={(event) => {
        const canvas = canvasRef.current;
        if (!canvas || trend.length === 0) {
          return;
        }

        const rect = canvas.getBoundingClientRect();
        const layout = calculateLayout(rect.width, rect.height);
        const x = event.clientX - rect.left;
        const progress = clamp((x - layout.chart.x) / layout.chart.width, 0, 1);
        const point = nearestTrendPoint(trend, progress);
        const firstChangedFile = point?.changedFiles[0]?.path;

        if (firstChangedFile) {
          onSelectFile(firstChangedFile);
        }
      }}
    />
  );
});

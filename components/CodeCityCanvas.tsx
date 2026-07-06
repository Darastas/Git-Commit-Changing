"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import {
  buildCommitTrend,
  interpolateTrendPoint,
  nearestTrendPoint,
  type CommitTrendPoint,
  type InterpolatedTrendPoint
} from "@/lib/movie/trend";
import type { MovieFile, RepoMovie } from "@/lib/movie/repo-movie-types";

type CodeCityCanvasProps = {
  movie: RepoMovie;
  playheadProgress: number;
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

function formatAxisDate(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return date.slice(0, 10);
  }
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatStars(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.max(0, Math.round(value)));
}

function formatHudDate(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return date.slice(0, 10);
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
  const gap = small ? 10 : 18;
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

function pointX(point: CommitTrendPoint, points: CommitTrendPoint[], chart: Rect, index: number) {
  if (points.length <= 1) {
    return chart.x + chart.width * 0.5;
  }

  const minTimestamp = points[0].timestamp;
  const maxTimestamp = points[points.length - 1].timestamp;
  if (minTimestamp === maxTimestamp) {
    return chart.x + (index / (points.length - 1)) * chart.width;
  }

  return chart.x + ((point.timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * chart.width;
}

function pointY(cumulativeCommits: number, maxCommits: number, chart: Rect) {
  const normalized = cumulativeCommits / Math.max(1, maxCommits);
  return chart.y + chart.height - normalized * chart.height;
}

function buildChartPoints(points: CommitTrendPoint[], chart: Rect): ChartPoint[] {
  const maxCommits = Math.max(1, points.length);
  return points.map((point, index) => ({
    x: pointX(point, points, chart, index),
    y: pointY(point.cumulativeCommits, maxCommits, chart),
    source: point
  }));
}

function buildStarChartPoints(points: CommitTrendPoint[], chart: Rect): ChartPoint[] {
  const maxStars = Math.max(1, ...points.map((point) => point.cumulativeStars));
  return points.map((point, index) => ({
    x: pointX(point, points, chart, index),
    y: pointY(point.cumulativeStars, maxStars, chart),
    source: point
  }));
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

function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    return;
  }

  appendCurveSegments(ctx, points);
}

function visualCursorPoint(coordinates: ChartPoint[], interpolated: InterpolatedTrendPoint) {
  if (coordinates.length <= 1) {
    return coordinates[0] ?? { x: 0, y: 0 };
  }

  const from = coordinates[interpolated.segmentIndex];
  const to = coordinates[Math.min(coordinates.length - 1, interpolated.segmentIndex + 1)];
  const { c1, c2 } = curveControls(from, to);
  return cubicPoint(from, c1, c2, to, interpolated.segmentProgress);
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

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, tempo: number) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#070909");
  background.addColorStop(0.42, "#11130f");
  background.addColorStop(1, "#090708");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const ambient = ctx.createRadialGradient(width * 0.28, height * 0.2, 20, width * 0.28, height * 0.2, width * 0.72);
  ambient.addColorStop(0, "rgba(20, 184, 166, 0.16)");
  ambient.addColorStop(0.46, "rgba(250, 204, 21, 0.055)");
  ambient.addColorStop(1, "rgba(244, 63, 94, 0)");
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

function drawAxes(ctx: CanvasRenderingContext2D, layout: ChartLayout, points: CommitTrendPoint[]) {
  const { chart, small } = layout;
  const maxCommits = Math.max(1, points.length);
  const maxStars = Math.max(0, ...points.map((point) => point.cumulativeStars));

  ctx.save();
  ctx.fillStyle = "rgba(7, 9, 9, 0.34)";
  ctx.beginPath();
  ctx.roundRect(chart.x - 8, chart.y - 8, chart.width + 16, chart.height + 16, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(231, 229, 228, 0.16)";
  ctx.lineWidth = 1;
  ctx.font = `${small ? 9 : 10}px ui-monospace, monospace`;
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

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const tickCount = Math.min(small ? 3 : 5, points.length);
  const used = new Set<number>();
  for (let tick = 0; tick < tickCount; tick += 1) {
    const index = tickCount === 1 ? 0 : Math.round((tick / (tickCount - 1)) * (points.length - 1));
    if (used.has(index)) {
      continue;
    }
    used.add(index);
    const x = pointX(points[index], points, chart, index);
    ctx.strokeStyle = "rgba(231, 229, 228, 0.1)";
    ctx.beginPath();
    ctx.moveTo(x, chart.y);
    ctx.lineTo(x, chart.y + chart.height);
    ctx.stroke();
    ctx.fillStyle = "rgba(214, 211, 209, 0.62)";
    ctx.fillText(formatAxisDate(points[index].date), x, chart.y + chart.height + 14);
  }

  ctx.strokeStyle = "rgba(245, 245, 244, 0.34)";
  ctx.beginPath();
  ctx.moveTo(chart.x, chart.y);
  ctx.lineTo(chart.x, chart.y + chart.height);
  ctx.lineTo(chart.x + chart.width, chart.y + chart.height);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${small ? 10 : 12}px ui-monospace, monospace`;
  ctx.fillStyle = "rgba(245, 245, 244, 0.9)";
  ctx.fillText("Cumulative commits", chart.x, chart.y - 18);
  ctx.font = `${small ? 9 : 10}px ui-monospace, monospace`;
  ctx.fillStyle = "rgba(214, 211, 209, 0.58)";
  ctx.fillText("dates with commits", chart.x + (small ? 118 : 152), chart.y - 18);
  if (maxStars > 0) {
    const legendX = chart.x + chart.width - (small ? 96 : 132);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.82)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX, chart.y - 21);
    ctx.lineTo(legendX + 20, chart.y - 21);
    ctx.stroke();
    ctx.fillStyle = "rgba(186, 230, 253, 0.82)";
    ctx.fillText(small ? "stars" : `estimated stars ${formatStars(maxStars)}`, legendX + 26, chart.y - 18);
  }
  ctx.restore();
}

function drawTrendCurve(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  points: CommitTrendPoint[],
  progress: number,
  tempo: number
) {
  const { chart } = layout;
  const coordinates = buildChartPoints(points, chart);
  const interpolated = interpolateTrendPoint(points, progress);
  if (!interpolated) {
    return undefined;
  }
  const cursor = visualCursorPoint(coordinates, interpolated);
  const revealed = coordinates.slice(0, interpolated.segmentIndex + 1);
  const last = revealed[revealed.length - 1];
  if (!last || Math.abs(last.x - cursor.x) > 0.01 || Math.abs(last.y - cursor.y) > 0.01) {
    revealed.push({ x: cursor.x, y: cursor.y, source: interpolated.right });
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(245, 245, 244, 0.18)";
  ctx.lineWidth = 1.6;
  drawSmoothPath(ctx, coordinates);
  ctx.stroke();

  if (revealed.length > 0) {
    const area = ctx.createLinearGradient(0, chart.y, 0, chart.y + chart.height);
    area.addColorStop(0, "rgba(20, 184, 166, 0.22)");
    area.addColorStop(0.55, "rgba(250, 204, 21, 0.08)");
    area.addColorStop(1, "rgba(244, 63, 94, 0.02)");

    ctx.beginPath();
    ctx.moveTo(revealed[0].x, chart.y + chart.height);
    ctx.lineTo(revealed[0].x, revealed[0].y);
    appendCurveSegments(ctx, revealed);
    ctx.lineTo(revealed[revealed.length - 1].x, chart.y + chart.height);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    const stroke = ctx.createLinearGradient(chart.x, 0, chart.x + chart.width, 0);
    stroke.addColorStop(0, "#14b8a6");
    stroke.addColorStop(0.52, "#facc15");
    stroke.addColorStop(1, "#fb7185");
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3.4;
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 16 + Math.sin(tempo * 2.4) * 4;
    drawSmoothPath(ctx, revealed);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 251, 235, 0.74)";
    ctx.lineWidth = 1.1;
    drawSmoothPath(ctx, revealed);
    ctx.stroke();
  }

  coordinates.forEach((point, index) => {
    const reached = index <= interpolated.segmentIndex || point.x <= cursor.x;
    ctx.beginPath();
    ctx.arc(point.x, point.y, reached ? 4.2 : 3, 0, Math.PI * 2);
    ctx.fillStyle = reached ? "rgba(255, 251, 235, 0.92)" : "rgba(168, 162, 158, 0.34)";
    ctx.fill();
    ctx.strokeStyle = reached ? "rgba(250, 204, 21, 0.68)" : "rgba(231, 229, 228, 0.16)";
    ctx.stroke();
  });

  const pulse = 1 + Math.sin(tempo * 4.8) * 0.12;
  ctx.strokeStyle = "rgba(250, 204, 21, 0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursor.x, chart.y);
  ctx.lineTo(cursor.x, chart.y + chart.height);
  ctx.stroke();

  const halo = ctx.createRadialGradient(cursor.x, cursor.y, 2, cursor.x, cursor.y, 34 * pulse);
  halo.addColorStop(0, "rgba(255, 251, 235, 0.82)");
  halo.addColorStop(0.26, "rgba(250, 204, 21, 0.34)");
  halo.addColorStop(1, "rgba(250, 204, 21, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff7d6";
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 5.2, 0, Math.PI * 2);
  ctx.fill();

  for (let trail = 1; trail <= 3; trail += 1) {
    const trailProgress = clamp(progress - trail * 0.045, 0, 1);
    const trailing = interpolateTrendPoint(points, trailProgress);
    if (!trailing) {
      continue;
    }
    const trailingPoint = visualCursorPoint(coordinates, trailing);
    ctx.fillStyle = `rgba(20, 184, 166, ${0.22 - trail * 0.045})`;
    ctx.beginPath();
    ctx.arc(trailingPoint.x, trailingPoint.y, 6 - trail, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return interpolated;
}

function drawStarTrendCurve(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  points: CommitTrendPoint[],
  progress: number,
  tempo: number
) {
  const totalStars = Math.max(0, ...points.map((point) => point.cumulativeStars));
  if (totalStars <= 0) {
    return;
  }

  const { chart } = layout;
  const coordinates = buildStarChartPoints(points, chart);
  const interpolated = interpolateTrendPoint(points, progress);
  if (!interpolated) {
    return;
  }

  const cursor = visualCursorPoint(coordinates, interpolated);
  const revealed = coordinates.slice(0, interpolated.segmentIndex + 1);
  const last = revealed[revealed.length - 1];
  if (!last || Math.abs(last.x - cursor.x) > 0.01 || Math.abs(last.y - cursor.y) > 0.01) {
    revealed.push({ x: cursor.x, y: cursor.y, source: interpolated.right });
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(125, 211, 252, 0.18)";
  ctx.lineWidth = 1.3;
  drawSmoothPath(ctx, coordinates);
  ctx.stroke();

  const stroke = ctx.createLinearGradient(chart.x, 0, chart.x + chart.width, 0);
  stroke.addColorStop(0, "rgba(20, 184, 166, 0.34)");
  stroke.addColorStop(0.5, "rgba(56, 189, 248, 0.82)");
  stroke.addColorStop(1, "rgba(186, 230, 253, 0.74)");
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12 + Math.sin(tempo * 2.1) * 3;
  drawSmoothPath(ctx, revealed);
  ctx.stroke();

  ctx.shadowBlur = 0;
  coordinates.forEach((point, index) => {
    const reached = index <= interpolated.segmentIndex || point.x <= cursor.x;
    ctx.fillStyle = reached ? "rgba(186, 230, 253, 0.86)" : "rgba(125, 211, 252, 0.24)";
    drawCanvasStar(ctx, point.x, point.y, reached ? 4.2 : 3.2);
    ctx.fill();
  });

  const halo = ctx.createRadialGradient(cursor.x, cursor.y, 2, cursor.x, cursor.y, 24);
  halo.addColorStop(0, "rgba(186, 230, 253, 0.76)");
  halo.addColorStop(0.42, "rgba(56, 189, 248, 0.24)");
  halo.addColorStop(1, "rgba(56, 189, 248, 0)");
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
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "rgba(168, 162, 158, 0.82)";
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255, 251, 235, 0.92)";
  drawFitText(ctx, value, x, y + 16, width);
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  movie: RepoMovie,
  point: CommitTrendPoint,
  selectedFile: MovieFile | undefined,
  progress: number,
  tempo: number
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
  progressGradient.addColorStop(0, "rgba(20, 184, 166, 0.42)");
  progressGradient.addColorStop(0.52, "rgba(250, 204, 21, 0.36)");
  progressGradient.addColorStop(1, "rgba(244, 63, 94, 0.32)");
  ctx.fillStyle = progressGradient;
  ctx.fillRect(hud.x, hud.y + hud.height - progressHeight, 3, progressHeight);

  const x = hud.x + padding;
  let y = hud.y + padding;
  const avatarRadius = small ? 19 : 24;
  const avatarX = x + avatarRadius;
  const avatarY = y + avatarRadius;
  const avatarGradient = ctx.createRadialGradient(avatarX - 8, avatarY - 8, 2, avatarX, avatarY, avatarRadius + 10);
  avatarGradient.addColorStop(0, "rgba(255, 251, 235, 0.98)");
  avatarGradient.addColorStop(0.42, "rgba(250, 204, 21, 0.9)");
  avatarGradient.addColorStop(1, "rgba(20, 184, 166, 0.74)");
  ctx.fillStyle = avatarGradient;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 251, 235, ${0.34 + Math.sin(tempo * 3.2) * 0.08})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "#090b0a";
  ctx.font = `800 ${small ? 13 : 16}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialsFor(point.authorName), avatarX, avatarY + 1);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const nameX = avatarX + avatarRadius + 10;
  const nameWidth = hud.x + hud.width - padding - nameX;
  ctx.font = `700 ${small ? 12 : 14}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 251, 235, 0.94)";
  drawFitText(ctx, point.authorName, nameX, y + avatarRadius - 1, nameWidth);
  ctx.font = `${small ? 10 : 11}px ui-monospace, monospace`;
  ctx.fillStyle = "rgba(168, 162, 158, 0.88)";
  drawFitText(ctx, point.authorLogin ? `@${point.authorLogin}` : point.shortSha, nameX, y + avatarRadius + 16, nameWidth);

  y += avatarRadius * 2 + (small ? 18 : 24);

  ctx.font = `800 ${small ? 24 : 32}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 251, 235, 0.98)";
  ctx.fillText(String(current), x, y + (small ? 24 : 32));
  ctx.font = `700 ${small ? 10 : 12}px ui-monospace, monospace`;
  ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
  ctx.fillText(`/ ${total} commits`, x + (small ? 34 : 46), y + (small ? 23 : 30));
  y += small ? 48 : 60;

  ctx.font = `700 ${small ? 11 : 13}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245, 245, 244, 0.92)";
  wrapText(ctx, point.message || "Untitled commit", x, y, contentWidth, small ? 15 : 17, small ? 2 : 3);
  y += small ? 46 : 64;

  const columnGap = small ? 8 : 12;
  const metricWidth = (contentWidth - columnGap) / 2;
  drawHudMetric(ctx, "Date", formatHudDate(point.date), x, y, metricWidth);
  drawHudMetric(ctx, "Files", String(point.changedFiles.length), x + metricWidth + columnGap, y, metricWidth);
  y += small ? 44 : 50;
  drawHudMetric(ctx, "Delta", `+${point.additions} / -${point.deletions}`, x, y, metricWidth);
  drawHudMetric(ctx, "Stars", formatStars(point.cumulativeStars), x + metricWidth + columnGap, y, metricWidth);
  y += small ? 48 : 56;

  if (y < hud.y + hud.height - 76) {
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(168, 162, 158, 0.76)";
    ctx.fillText("SHA", x, y - 6);
    ctx.font = `700 ${small ? 10 : 11}px ui-monospace, monospace`;
    ctx.fillStyle = "rgba(214, 211, 209, 0.86)";
    drawFitText(ctx, point.shortSha, x + 28, y - 6, contentWidth - 28);
    y += small ? 18 : 20;
  }

  if (selectedFile && y < hud.y + hud.height - 34) {
    ctx.fillStyle = "rgba(20, 184, 166, 0.1)";
    ctx.strokeStyle = "rgba(20, 184, 166, 0.24)";
    ctx.beginPath();
    ctx.roundRect(x, y - 12, contentWidth, small ? 42 : 48, 7);
    ctx.fill();
    ctx.stroke();
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(168, 162, 158, 0.86)";
    ctx.fillText("SELECTED FILE", x + 10, y + 2);
    ctx.font = `700 ${small ? 10 : 11}px ui-monospace, monospace`;
    ctx.fillStyle = "rgba(236, 253, 245, 0.92)";
    drawFitText(ctx, selectedFile.path, x + 10, y + 19, contentWidth - 20);
  }

  ctx.restore();
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number) {
  drawBackground(ctx, width, height, 0);
  ctx.save();
  ctx.fillStyle = "rgba(245, 245, 244, 0.86)";
  ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("No commit data available", width / 2, height / 2);
  ctx.restore();
}

export const CodeCityCanvas = forwardRef<HTMLCanvasElement, CodeCityCanvasProps>(function CodeCityCanvas(
  { movie, playheadProgress, selectedPath, onSelectFile },
  forwardedRef
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);
  const trend = useMemo(() => buildCommitTrend(movie), [movie]);
  const selectedFile = selectedPath ? movie.files[selectedPath] : undefined;

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

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (trend.length === 0) {
        drawEmptyState(ctx, width, height);
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      const layout = calculateLayout(width, height);
      const progress = trend.length <= 1 ? 1 : clamp(playheadProgress, 0, 1);
      const activePoint = nearestTrendPoint(trend, progress) ?? trend[0];

      drawBackground(ctx, width, height, tempo);
      drawAxes(ctx, layout, trend);
      drawStarTrendCurve(ctx, layout, trend, progress, tempo);
      drawTrendCurve(ctx, layout, trend, progress, tempo);
      drawHud(ctx, layout, movie, activePoint, selectedFile, progress, tempo);

      ctx.save();
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillStyle = "rgba(214, 211, 209, 0.72)";
      ctx.fillText(`${movie.repo.fullName} / ${movie.repo.defaultBranch}`, 18, height - 18);
      ctx.restore();

      animationFrame = window.requestAnimationFrame(draw);
    }

    draw(performance.now());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [movie, playheadProgress, selectedFile, trend]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full min-h-[28rem] w-full rounded-[0.45rem] border border-stone-700/70 bg-stone-950 shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
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

"use client";

import { useLanguage } from "./language";

type TimelineProps = {
  frameIndex: number;
  max: number;
  onChange: (nextIndex: number) => void;
};

export function Timeline({ frameIndex, max, onChange }: TimelineProps) {
  const { t } = useLanguage();

  return (
    <input
      aria-label={t("movieTimeline")}
      className="movie-timeline h-4 w-full"
      type="range"
      min={0}
      max={Math.max(0, max)}
      value={frameIndex}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

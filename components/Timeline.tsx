"use client";

type TimelineProps = {
  frameIndex: number;
  max: number;
  onChange: (nextIndex: number) => void;
};

export function Timeline({ frameIndex, max, onChange }: TimelineProps) {
  return (
    <input
      aria-label="Movie timeline"
      className="movie-timeline h-4 w-full"
      type="range"
      min={0}
      max={Math.max(0, max)}
      value={frameIndex}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

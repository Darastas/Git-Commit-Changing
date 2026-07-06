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
      className="h-2 w-full accent-amber-300"
      type="range"
      min={0}
      max={Math.max(0, max)}
      value={frameIndex}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

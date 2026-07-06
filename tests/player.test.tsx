// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MoviePlayer } from "@/components/MoviePlayer";
import { sampleMovie } from "@/lib/movie/sample-data";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = ((() => ({
    setTransform: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    beginPath: () => undefined,
    closePath: () => undefined,
    roundRect: () => undefined,
    arc: () => undefined,
    ellipse: () => undefined,
    measureText: (text: string) => ({ width: text.length * 7 }),
    fill: () => undefined,
    stroke: () => undefined,
    fillText: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    moveTo: () => undefined,
    quadraticCurveTo: () => undefined,
    bezierCurveTo: () => undefined,
    lineTo: () => undefined
  })) as unknown) as typeof HTMLCanvasElement.prototype.getContext;
});

describe("MoviePlayer", () => {
  it("renders the playable commit trend workspace controls for a movie", () => {
    render(<MoviePlayer movie={sampleMovie} />);

    expect(screen.getByText("demo/signal-studio")).toBeTruthy();
    expect(screen.getByLabelText("Pause movie")).toBeTruthy();
    expect(screen.getByLabelText("Movie timeline")).toBeTruthy();
    expect(screen.getByText("JSON")).toBeTruthy();
    expect(screen.getByText("PNG")).toBeTruthy();
    expect(screen.getByText("WebM")).toBeTruthy();
    expect(screen.getAllByText("Bootstrap interface shell").length).toBeGreaterThan(0);
  });

  it("uses the right rail for author identity and commit annotations", () => {
    render(<MoviePlayer movie={sampleMovie} />);

    expect(screen.getByText("Commit trail")).toBeTruthy();
    expect(screen.getByText("@mina")).toBeTruthy();
    expect(screen.getByText("Draw commit trend timeline")).toBeTruthy();
    expect(screen.getByText("2024/1/2")).toBeTruthy();
  });

  it("confirms when the share URL has been copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    render(<MoviePlayer movie={sampleMovie} jobId="job-123" />);

    fireEvent.click(screen.getByText("Share"));

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/movie/job-123");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("shows a clear state when the share URL could not be copied", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    render(<MoviePlayer movie={sampleMovie} jobId="job-123" />);

    fireEvent.click(screen.getByText("Share"));

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/movie/job-123");
    expect(await screen.findByText("Copy failed")).toBeTruthy();
  });
});

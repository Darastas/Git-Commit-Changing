// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
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
    fill: () => undefined,
    stroke: () => undefined,
    fillText: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined
  })) as unknown) as typeof HTMLCanvasElement.prototype.getContext;
});

describe("MoviePlayer", () => {
  it("renders the playable code city workspace controls for a movie", () => {
    render(<MoviePlayer movie={sampleMovie} />);

    expect(screen.getByText("demo/signal-studio")).toBeTruthy();
    expect(screen.getByLabelText("Pause movie")).toBeTruthy();
    expect(screen.getByLabelText("Movie timeline")).toBeTruthy();
    expect(screen.getByText("JSON")).toBeTruthy();
    expect(screen.getByText("PNG")).toBeTruthy();
    expect(screen.getByText("WebM")).toBeTruthy();
    expect(screen.getByText("Bootstrap interface shell")).toBeTruthy();
  });
});

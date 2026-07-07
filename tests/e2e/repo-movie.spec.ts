import { expect, test, type Page } from "@playwright/test";
import { sampleMovie } from "../../lib/movie/sample-data";
import type { AnalysisJob } from "../../lib/jobs/job-types";
import type { RepoMovie } from "../../lib/movie/repo-movie-types";

const generatedMovie: RepoMovie = {
  ...sampleMovie,
  repo: {
    ...sampleMovie.repo,
    owner: "octocat",
    name: "Hello-World",
    fullName: "octocat/Hello-World",
    url: "https://github.com/octocat/Hello-World",
    description: "Mocked e2e repository movie"
  }
};

function makeJob(id: string, status: AnalysisJob["status"] = "succeeded"): AnalysisJob {
  return {
    id,
    repo: "octocat/Hello-World",
    normalizedRepo: "octocat/Hello-World",
    commitLimit: 30,
    status,
    progressStage: status === "succeeded" ? "ready" : "fetching-commits",
    progressPercent: status === "succeeded" ? 100 : 45,
    resultStorageKey: status === "succeeded" ? `github:octocat:hello-world:main:${generatedMovie.repo.latestSha}:30` : undefined,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:02.000Z"
  };
}

async function mockMovieApi(page: Page, jobId: string) {
  await page.route("**/api/jobs", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as { repo?: string; commitLimit?: number };
    expect(body).toMatchObject({
      repo: "octocat/Hello-World",
      commitLimit: 100
    });

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ job: makeJob(jobId, "queued") })
    });
  });

  await page.route(`**/api/jobs/${jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ job: makeJob(jobId) })
    });
  });

  await page.route(`**/api/movies/${jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ movie: generatedMovie })
    });
  });
}

async function canvasHasContent(page: Page) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 0; index < data.length; index += 16) {
      if (data[index] + data[index + 1] + data[index + 2] > 45) {
        return true;
      }
    }

    return false;
  });
}

test("loads a mocked repo movie from the query parameter and exercises playback controls", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });

  await mockMovieApi(page, "job-query-e2e");
  await page.goto("/?repo=octocat/Hello-World");

  await expect(page).toHaveTitle(/Repo Movie Machine/);
  await expect(page.getByRole("heading", { name: "octocat/Hello-World" })).toBeVisible();
  await expect(page.getByText("@mina")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Commit trail" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Jump to commit 3: Draw commit trend timeline/ })).toBeVisible();
  await expect.poll(() => canvasHasContent(page)).toBe(true);

  await page.getByRole("button", { name: "Pause movie" }).click();
  await expect(page.getByRole("button", { name: "Play movie" })).toBeVisible();

  await page.getByLabel("Movie timeline").fill("0");
  await expect(page.getByText("1/4")).toBeVisible();

  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByRole("heading", { name: "提交轨迹" })).toBeVisible();
  await expect(page.getByLabel("电影时间线")).toBeVisible();
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByLabel("Movie timeline")).toBeVisible();

  expect(messages.filter((message) => !message.includes("Download the React DevTools"))).toEqual([]);
});

test("loads a shared movie URL and exports JSON and PNG artifacts", async ({ page, context }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });

  await context.grantPermissions(["clipboard-write"], { origin: "http://localhost:3000" });
  await mockMovieApi(page, "job-share-e2e");
  await page.goto("/movie/job-share-e2e");

  await expect(page.getByRole("heading", { name: "octocat/Hello-World" })).toBeVisible();
  await expect.poll(() => canvasHasContent(page)).toBe(true);

  await page.getByRole("button", { name: "Copy share link" }).click();
  await expect(page.getByRole("button", { name: "Share link copied" })).toBeVisible();

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByText("JSON").click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe("octocat-Hello-World-movie.json");

  const pngDownloadPromise = page.waitForEvent("download");
  await page.getByText("PNG").click();
  const pngDownload = await pngDownloadPromise;
  expect(pngDownload.suggestedFilename()).toBe("octocat-Hello-World-snapshot.png");

  expect(messages.filter((message) => !message.includes("Download the React DevTools"))).toEqual([]);
});

import { normalizeGitHubRepoInput } from "@/lib/github/github-url";
import { normalizeCommitLimit } from "./limits";

export function validateCreateJobPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const body = payload as Record<string, unknown>;
  if (typeof body.repo !== "string") {
    throw new Error("Repository is required.");
  }

  const repo = normalizeGitHubRepoInput(body.repo);
  const commitLimit = normalizeCommitLimit(body.commitLimit);

  return {
    repo: body.repo,
    normalizedRepo: repo.fullName,
    owner: repo.owner,
    name: repo.repo,
    commitLimit
  };
}

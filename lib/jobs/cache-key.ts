export type MovieCacheKeyInput = {
  provider: string;
  owner: string;
  repo: string;
  branch: string;
  latestSha: string;
  commitLimit: number;
};

export function buildMovieCacheKey(input: MovieCacheKeyInput) {
  return [
    input.provider,
    input.owner,
    input.repo,
    input.branch,
    input.latestSha,
    String(input.commitLimit)
  ]
    .map((part) => part.trim().toLowerCase())
    .join(":");
}

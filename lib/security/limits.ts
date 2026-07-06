export const ALL_COMMITS_LIMIT = 0;
export const SUPPORTED_COMMIT_LIMITS = [30, 100, 250, 500, ALL_COMMITS_LIMIT] as const;
export const DEFAULT_COMMIT_LIMIT = 100;
export const REQUEST_COOLDOWN_MS = 10_000;

export type SupportedCommitLimit = (typeof SUPPORTED_COMMIT_LIMITS)[number];

export function normalizeCommitLimit(value: unknown): SupportedCommitLimit {
  const numeric = value === undefined || value === null || value === "" ? DEFAULT_COMMIT_LIMIT : Number(value);
  if (SUPPORTED_COMMIT_LIMITS.includes(numeric as SupportedCommitLimit)) {
    return numeric as SupportedCommitLimit;
  }

  throw new Error("Commit limit must be 30, 100, 250, 500, or All.");
}

export function enforceRequestCooldown(
  key: string,
  state: Map<string, number>,
  now = Date.now(),
  cooldownMs = REQUEST_COOLDOWN_MS
) {
  const lastSeen = state.get(key);
  if (lastSeen !== undefined && now - lastSeen < cooldownMs) {
    return false;
  }

  state.set(key, now);
  return true;
}

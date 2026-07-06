import type { RepoMovie } from "@/lib/movie/repo-movie-types";

export interface MovieStorage {
  get(key: string): Promise<RepoMovie | undefined>;
  set(key: string, movie: RepoMovie): Promise<void>;
}

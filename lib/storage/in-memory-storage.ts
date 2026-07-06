import type { RepoMovie } from "@/lib/movie/repo-movie-types";
import type { MovieStorage } from "./storage";

type StorageGlobal = typeof globalThis & {
  __repoMovieStorage?: InMemoryMovieStorage;
};

export class InMemoryMovieStorage implements MovieStorage {
  private readonly movies = new Map<string, RepoMovie>();

  async get(key: string): Promise<RepoMovie | undefined> {
    return this.movies.get(key);
  }

  async set(key: string, movie: RepoMovie): Promise<void> {
    this.movies.set(key, movie);
  }
}

export function getMovieStorage(): InMemoryMovieStorage {
  const storageGlobal = globalThis as StorageGlobal;
  storageGlobal.__repoMovieStorage ??= new InMemoryMovieStorage();
  return storageGlobal.__repoMovieStorage;
}

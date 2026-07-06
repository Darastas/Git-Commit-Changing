import { Suspense } from "react";
import { MovieWorkspace } from "@/components/MovieWorkspace";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-stone-950 text-sm text-stone-300">
          Loading Repo Movie Machine...
        </main>
      }
    >
      <MovieWorkspace />
    </Suspense>
  );
}

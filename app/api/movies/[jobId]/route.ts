import { getJobStore } from "@/lib/jobs/in-memory-job-store";
import { getMovieStorage } from "@/lib/storage/in-memory-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobStore().get(jobId);

  if (!job) {
    return Response.json(
      {
        error: {
          code: "job_not_found",
          message: "Analysis job was not found.",
          retryable: false
        }
      },
      { status: 404 }
    );
  }

  if (job.status !== "succeeded" || !job.resultStorageKey) {
    return Response.json(
      {
        error: {
          code: "movie_not_ready",
          message: "The movie is not ready yet.",
          retryable: true
        },
        job
      },
      { status: 409 }
    );
  }

  const movie = await getMovieStorage().get(job.resultStorageKey);
  if (!movie) {
    return Response.json(
      {
        error: {
          code: "movie_missing",
          message: "The job succeeded, but its movie artifact is missing from storage.",
          retryable: false
        }
      },
      { status: 500 }
    );
  }

  return Response.json({ movie });
}

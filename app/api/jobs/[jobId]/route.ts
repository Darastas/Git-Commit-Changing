import { getJobStore } from "@/lib/jobs/in-memory-job-store";

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

  return Response.json({ job });
}

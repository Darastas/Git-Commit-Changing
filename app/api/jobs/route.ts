import { createAnalysisJob } from "@/lib/jobs/queue";
import { enforceRequestCooldown } from "@/lib/security/limits";

const cooldownState = new Map<string, number>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  try {
    if (!enforceRequestCooldown(clientKey(request), cooldownState)) {
      return Response.json(
        {
          error: {
            code: "request_cooldown",
            message: "Please wait a few seconds before creating another analysis job.",
            retryable: true
          }
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as unknown;
    const job = await createAnalysisJob({
      repo: (body as { repo?: unknown }).repo as string,
      commitLimit: (body as { commitLimit?: unknown }).commitLimit
    });

    return Response.json({ job }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The job could not be created.";
    return Response.json(
      {
        error: {
          code: "invalid_job_request",
          message,
          retryable: false
        }
      },
      { status: 400 }
    );
  }
}

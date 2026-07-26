import type { ProcessJobDeps } from "../types/process-job-deps.interface.js";

/** The worker's actual job-processing steps, pulled out of `content-generation.worker.ts`
 *  so they're testable with fakes/stubs — importing that file connects to Redis as a side
 *  effect (it constructs a live BullMQ `Worker`), which this module avoids. */
export async function processContentGenerationJob(
  contentId: string,
  deps: ProcessJobDeps
): Promise<void> {
  const processing = await deps.statusService.markProcessing(contentId);
  // null only happens if the status wasn't PENDING nor PROCESSING — i.e. already CANCELED
  // (or terminal) before this attempt. On a 2nd+ attempt (BullMQ retry after the simulated
  // failure), status is already PROCESSING from the 1st call, and markProcessing accepts
  // that (spec 04) — this is not treated as a cancellation.
  if (!processing) return;

  const text = await deps.simulateAiCall(processing.topic);

  const resultUrl = await deps.uploadContentFile(contentId, text);

  // null here means canceled during processing. The file already made it to S3, but the
  // record stays CANCELED — not a worker error, it's the race's expected outcome (see
  // .claude/rules/business-rules.md). No rollback of the upload: an orphaned S3 object is
  // acceptable, an inconsistent DB state is not.
  await deps.statusService.markCompleted(contentId, resultUrl);
}

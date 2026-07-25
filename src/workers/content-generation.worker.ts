import { Worker } from "bullmq";
import { CONTENT_QUEUE_NAME } from "../lib/queue.js";
import { redisConnection } from "../lib/redis.js";
import { uploadContentFile } from "../lib/upload-content-file.js";
import { PrismaContentRepository } from "../repositories/content.repository.js";
import { ContentStatusService } from "../services/content-status.service.js";
import type { GenerateContentJobData } from "../services/content-generation.service.js";
import { simulateAiCall } from "./simulate-ai-call.js";
import { shouldMarkFailed } from "./should-mark-failed.js";

const statusService = new ContentStatusService(new PrismaContentRepository());

export const contentGenerationWorker = new Worker<GenerateContentJobData>(
  CONTENT_QUEUE_NAME,
  async (job) => {
    const { contentId } = job.data;

    const processing = await statusService.markProcessing(contentId);
    // null only happens if the status wasn't PENDING nor PROCESSING — i.e. already
    // CANCELED (or terminal) before this attempt. On a 2nd+ attempt (BullMQ retry after
    // the simulated failure), status is already PROCESSING from the 1st call, and
    // markProcessing accepts that (spec 04) — this is not treated as a cancellation.
    if (!processing) return;

    const text = await simulateAiCall(processing.topic);

    const resultUrl = await uploadContentFile(contentId, text);

    // null here means canceled during processing. The file already made it to S3, but
    // the record stays CANCELED — not a worker error, it's the race's expected outcome
    // (see .claude/rules/business-rules.md). No rollback of the upload: an orphaned S3
    // object is acceptable, an inconsistent DB state is not.
    await statusService.markCompleted(contentId, resultUrl);
  },
  { connection: redisConnection }
);

contentGenerationWorker.on("failed", async (job) => {
  if (!job || !shouldMarkFailed(job)) return; // still has retries left
  await statusService.markFailed(job.data.contentId);
});

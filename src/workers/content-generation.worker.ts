import { Worker } from "bullmq";
import { CONTENT_QUEUE_NAME } from "../lib/queue-name.js";
import { redisConnection } from "../lib/redis.js";
import { uploadContentFile } from "../lib/upload-content-file.js";
import { PrismaContentRepository } from "../repositories/content.repository.js";
import { ContentStatusService } from "../services/content-status.service.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.js";
import { simulateAiCall } from "./simulate-ai-call.js";
import { shouldMarkFailed } from "./should-mark-failed.js";
import { processContentGenerationJob } from "./process-content-generation-job.js";

const statusService = new ContentStatusService(new PrismaContentRepository());

export const contentGenerationWorker = new Worker<GenerateContentJobData>(
  CONTENT_QUEUE_NAME,
  async (job) => {
    await processContentGenerationJob(job.data.contentId, {
      statusService,
      simulateAiCall,
      uploadContentFile,
    });
  },
  { connection: redisConnection }
);

contentGenerationWorker.on("failed", async (job) => {
  if (!job || !shouldMarkFailed(job)) return; // still has retries left
  await statusService.markFailed(job.data.contentId);
});

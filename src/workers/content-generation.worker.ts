import {
  Worker,
  type ConnectionOptions,
  type Processor,
  type WorkerOptions,
} from "bullmq";
import { CONTENT_QUEUE_NAME } from "../lib/queue-name.js";
import type { ContentStatusService } from "../services/content-status.service.js";
import type { ContentStorage } from "../types/content-storage.interface.js";
import type { ContentWorker } from "../types/content-worker.interface.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.interface.js";
import { simulateAiCall as defaultSimulateAiCall } from "./default-simulate-ai-call.js";
import { shouldMarkFailed } from "./should-mark-failed.js";
import { processContentGenerationJob } from "./process-content-generation-job.js";
import { processContentCleanupJob } from "./process-content-cleanup-job.js";

interface WorkerLogger {
  info(message: string, context: Record<string, unknown>): void;
  error(message: string, context: Record<string, unknown>): void;
}

type WorkerFactory = (
  name: string,
  processor: Processor<GenerateContentJobData>,
  options: WorkerOptions
) => ContentWorker;

const consoleLogger: WorkerLogger = {
  info: (message, context) => console.log(message, context),
  error: (message, context) => console.error(message, context),
};

export function createContentGenerationWorker(input: {
  connection: ConnectionOptions;
  statusService: ContentStatusService;
  contentStorage: ContentStorage;
  simulateAiCall?: (topic: string) => Promise<string>;
  queueName?: string;
  logger?: WorkerLogger;
  workerFactory?: WorkerFactory;
}): ContentWorker {
  const logger = input.logger ?? consoleLogger;
  const simulateAiCall = input.simulateAiCall ?? defaultSimulateAiCall;
  const workerFactory: WorkerFactory =
    input.workerFactory ??
    ((name, processor, options) => new Worker(name, processor, options));

  const worker = workerFactory(
    input.queueName ?? CONTENT_QUEUE_NAME,
    async (job) => {
      if (job.name === "cleanup-content") {
        await processContentCleanupJob(job.data.contentId, input.contentStorage);
        return;
      }

      logger.info("Processing content generation", {
        requestId: job.data.requestId,
        contentId: job.data.contentId,
        jobId: job.id,
      });
      await processContentGenerationJob(job.data.contentId, job.data.requestId, {
        statusService: input.statusService,
        simulateAiCall,
        contentStorage: input.contentStorage,
      });
    },
    { connection: input.connection }
  );

  worker.on("failed", async (job) => {
    if (!job || job.name !== "generate-content" || !shouldMarkFailed(job)) return;
    logger.error("Content generation exhausted retries", {
      requestId: job.data.requestId,
      contentId: job.data.contentId,
      jobId: job.id,
    });
    try {
      const result = await input.statusService.finalizeFailure(job.data.contentId);
      if (result !== "retry_required") {
        await job.updateData({ ...job.data, terminalStatusPersisted: true });
      }
    } catch (error) {
      logger.error("Failed to persist terminal content status", {
        requestId: job.data.requestId,
        contentId: job.data.contentId,
        error,
      });
    }
  });

  return worker;
}

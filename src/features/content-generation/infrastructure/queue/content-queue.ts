import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { CONTENT_QUEUE_NAME } from "./queue-name.js";
import type { GenerateContentJobData } from "./generate-content-job-data.interface.js";
import { LIMITS } from "../../../../shared/config/limits.js";

const CONTENT_JOB_OPTIONS = {
  attempts: LIMITS.contentGenerationJob.attempts,
  backoff: { type: "exponential", delay: LIMITS.contentGenerationJob.backoffDelayMs },
  removeOnComplete: {
    age: LIMITS.contentGenerationJob.completedRetention.ageSeconds,
    count: LIMITS.contentGenerationJob.completedRetention.count,
  },
  removeOnFail: false,
} satisfies JobsOptions;

export function createContentQueue(
  connection: ConnectionOptions,
  queueName = CONTENT_QUEUE_NAME
): Queue<GenerateContentJobData> {
  return new Queue<GenerateContentJobData>(queueName, {
    connection,
    defaultJobOptions: CONTENT_JOB_OPTIONS,
  });
}

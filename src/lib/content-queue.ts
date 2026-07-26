import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { CONTENT_QUEUE_NAME } from "./queue-name.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.interface.js";

const CONTENT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
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

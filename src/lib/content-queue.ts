import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";
import { CONTENT_QUEUE_NAME } from "./queue-name.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.interface.js";

export const contentQueue = new Queue<GenerateContentJobData>(CONTENT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";
import type { GenerateContentJobData } from "../services/content-generation.service.js";

export const CONTENT_QUEUE_NAME = "content-generation";

export const contentQueue = new Queue<GenerateContentJobData>(CONTENT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false, // keeps the failed job for inspection; content already becomes FAILED in the DB
  },
});

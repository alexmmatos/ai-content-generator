import { z } from "zod";
import { baseEnvSchema } from "./base-env.schema.js";

export const workerEnvSchema = baseEnvSchema.extend({
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_PUBLIC_URL: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  FAILED_RECONCILIATION_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  SIMULATED_AI_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
});

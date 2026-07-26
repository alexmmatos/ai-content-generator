import "dotenv/config";
import { z } from "zod";

const runtimeSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
});

export const apiEnvSchema = runtimeSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
});

export const workerEnvSchema = runtimeSchema.extend({
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

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseApiEnv(input: NodeJS.ProcessEnv): ApiEnv {
  return apiEnvSchema.parse(input);
}

export function parseWorkerEnv(input: NodeJS.ProcessEnv): WorkerEnv {
  return workerEnvSchema.parse(input);
}

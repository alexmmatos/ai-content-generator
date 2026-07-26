import "dotenv/config";
import { apiEnvSchema } from "./api-env.schema.js";
import type { ApiEnv } from "./api-env.type.js";

export function parseApiEnv(input: NodeJS.ProcessEnv): ApiEnv {
  return apiEnvSchema.parse(input);
}

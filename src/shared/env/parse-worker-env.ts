import "dotenv/config";
import { workerEnvSchema } from "./worker-env.schema.js";
import type { WorkerEnv } from "./worker-env.type.js";

export function parseWorkerEnv(input: NodeJS.ProcessEnv): WorkerEnv {
  return workerEnvSchema.parse(input);
}

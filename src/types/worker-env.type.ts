import type { z } from "zod";
import type { workerEnvSchema } from "../lib/worker-env.schema.js";

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

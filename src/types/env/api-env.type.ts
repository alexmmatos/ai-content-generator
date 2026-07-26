import type { z } from "zod";
import type { apiEnvSchema } from "../../lib/env/api-env.schema.js";

export type ApiEnv = z.infer<typeof apiEnvSchema>;

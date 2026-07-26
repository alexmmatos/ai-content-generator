import { z } from "zod";
import { baseEnvSchema } from "./base-env.schema.js";

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
});

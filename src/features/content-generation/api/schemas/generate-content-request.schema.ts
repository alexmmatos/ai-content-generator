import { z } from "zod";
import { LIMITS } from "../../../../shared/config/limits.js";

export const GenerateContentRequestSchema = z.object({
  topic: z.string().min(LIMITS.topic.minLength).max(LIMITS.topic.maxLength),
  userId: z.string().uuid(),
});

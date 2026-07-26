import { z } from "zod";

export const GenerateContentRequestSchema = z.object({
  topic: z.string().min(1).max(500),
  userId: z.string().uuid(),
});

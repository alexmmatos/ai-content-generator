import { z } from "zod";
import { ContentStatusSchema } from "./content-status.schema.js";

export const ContentResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.string(),
  status: ContentStatusSchema,
  resultUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

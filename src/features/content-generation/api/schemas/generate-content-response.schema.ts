import { z } from "zod";
import { ContentStatusSchema } from "./content-status.schema.js";

export const GenerateContentResponseSchema = z.object({
  requestId: z.string().uuid(),
  contentId: z.string().uuid(),
  status: ContentStatusSchema,
});

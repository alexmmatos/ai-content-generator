import { z } from "zod";
import { ContentStatusSchema } from "./content-status.schema.js";

export const CancelContentResponseSchema = z.object({
  id: z.string().uuid(),
  status: ContentStatusSchema,
  canceled: z.boolean(),
});

import { z } from "zod";
import { ContentStatusSchema } from "./content-status.schema.js";

export const GenerateContentResponseSchema = z.object({
  requestId: z.string().uuid().describe("O `request-id` enviado (ou gerado pela API)."),
  contentId: z.string().uuid().describe("ID a ser usado em GET /:id e POST /:id/cancel."),
  status: ContentStatusSchema,
});

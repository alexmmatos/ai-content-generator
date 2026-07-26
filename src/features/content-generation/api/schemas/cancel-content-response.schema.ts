import { z } from "zod";
import { ContentStatusSchema } from "./content-status.schema.js";

export const CancelContentResponseSchema = z.object({
  id: z.string().uuid().describe("ID do conteúdo."),
  status: ContentStatusSchema,
  canceled: z
    .boolean()
    .describe(
      "true se esta chamada aplicou o cancelamento; false se já estava CANCELED ou já " +
        "tinha chegado a um estado terminal antes do pedido."
    ),
});

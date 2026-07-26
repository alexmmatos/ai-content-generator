import { z } from "zod";

export const GenerateContentHeadersSchema = z.object({
  "request-id": z.string().uuid().optional(),
});

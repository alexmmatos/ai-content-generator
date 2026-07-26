import type { z } from "zod";
import type { GenerateContentResponseSchema } from "../schemas/generate-content-response.schema.js";

export type GenerateContentResponse = z.infer<typeof GenerateContentResponseSchema>;

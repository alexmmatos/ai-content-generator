import type { z } from "zod";
import type { GenerateContentResponseSchema } from "./generate-content-response.schema.js";

export type GenerateContentResponse = z.infer<typeof GenerateContentResponseSchema>;

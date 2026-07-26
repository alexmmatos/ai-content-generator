import type { z } from "zod";
import type { GenerateContentRequestSchema } from "./generate-content-request.schema.js";

export type GenerateContentRequest = z.infer<typeof GenerateContentRequestSchema>;

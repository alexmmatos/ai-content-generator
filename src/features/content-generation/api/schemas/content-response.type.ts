import type { z } from "zod";
import type { ContentResponseSchema } from "./content-response.schema.js";

export type ContentResponse = z.infer<typeof ContentResponseSchema>;

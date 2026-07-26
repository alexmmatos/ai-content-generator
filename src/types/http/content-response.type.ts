import type { z } from "zod";
import type { ContentResponseSchema } from "../../schemas/content-response.schema.js";

export type ContentResponse = z.infer<typeof ContentResponseSchema>;

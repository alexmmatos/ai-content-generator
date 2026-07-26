import type { z } from "zod";
import type { CancelContentResponseSchema } from "./cancel-content-response.schema.js";

export type CancelContentResponse = z.infer<typeof CancelContentResponseSchema>;

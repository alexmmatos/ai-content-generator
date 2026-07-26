import type { z } from "zod";
import type { ErrorResponseSchema } from "./error-response.schema.js";

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

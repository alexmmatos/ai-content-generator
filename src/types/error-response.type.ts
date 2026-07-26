import type { z } from "zod";
import type { ErrorResponseSchema } from "../schemas/error-response.schema.js";

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

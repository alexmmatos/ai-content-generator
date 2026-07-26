import type { z } from "zod";
import type { ContentIdParamSchema } from "../schemas/content-id-param.schema.js";

export type ContentIdParam = z.infer<typeof ContentIdParamSchema>;

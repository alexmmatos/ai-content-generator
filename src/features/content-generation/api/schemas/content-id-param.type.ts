import type { z } from "zod";
import type { ContentIdParamSchema } from "./content-id-param.schema.js";

export type ContentIdParam = z.infer<typeof ContentIdParamSchema>;

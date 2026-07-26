import { z } from "zod";
import { CONTENT_STATUSES } from "../../domain/content-statuses.js";

export const ContentStatusSchema = z.enum(CONTENT_STATUSES);

import { z } from "zod";
import { CONTENT_STATUSES } from "../domain/content.js";

export const ContentStatusSchema = z.enum(CONTENT_STATUSES);

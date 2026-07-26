import { z } from "zod";

export const ContentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELED",
  "FAILED",
]);

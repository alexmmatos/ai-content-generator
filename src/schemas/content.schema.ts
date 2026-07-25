import { z } from "zod";

export const ContentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELED",
  "FAILED",
]);

export const GenerateContentRequestSchema = z.object({
  topic: z.string().min(1).max(500),
  userId: z.string().uuid(),
});
export type GenerateContentRequest = z.infer<typeof GenerateContentRequestSchema>;

export const GenerateContentResponseSchema = z.object({
  contentId: z.string().uuid(),
  status: ContentStatusSchema,
});
export type GenerateContentResponse = z.infer<typeof GenerateContentResponseSchema>;

export const ContentResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.string(),
  status: ContentStatusSchema,
  resultUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ContentResponse = z.infer<typeof ContentResponseSchema>;

export const ContentIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type ContentIdParam = z.infer<typeof ContentIdParamSchema>;

export const CancelContentResponseSchema = z.object({
  id: z.string().uuid(),
  status: ContentStatusSchema,
});
export type CancelContentResponse = z.infer<typeof CancelContentResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

import { z } from "zod";
import { ContentStatusSchema } from "./content-status.schema.js";

export const ContentResponseSchema = z.object({
  id: z.string().uuid().describe("ID do conteúdo."),
  requestId: z.string().uuid().describe("`request-id` usado na criação, para rastreio."),
  userId: z.string().uuid().describe("ID do usuário dono do conteúdo."),
  topic: z.string().describe("Tema original enviado em POST /generate."),
  status: ContentStatusSchema,
  resultUrl: z
    .string()
    .url()
    .nullable()
    .describe("URL do .txt em S3/Minio quando `status` é COMPLETED; `null` caso contrário."),
  createdAt: z.string().datetime().describe("Data/hora de criação, em UTC."),
  updatedAt: z.string().datetime().describe("Data/hora da última transição de status, em UTC."),
});

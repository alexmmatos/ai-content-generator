import { z } from "zod";
import { LIMITS } from "../../../../shared/config/limits.js";

export const GenerateContentRequestSchema = z.object({
  topic: z
    .string()
    .min(LIMITS.topic.minLength)
    .max(LIMITS.topic.maxLength)
    .describe("Tema do conteúdo a ser gerado pela IA."),
  userId: z.string().uuid().describe("ID do usuário que será debitado em 1 crédito."),
});

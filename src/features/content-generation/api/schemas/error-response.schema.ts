import { z } from "zod";

export const ErrorResponseSchema = z.object({
  error: z.string().describe("Mensagem de erro legível."),
  details: z.string().optional().describe("Detalhe adicional, ex.: erros de validação Zod."),
});

import { z } from "zod";

export const GenerateContentHeadersSchema = z.object({
  "request-id": z
    .string()
    .uuid()
    .optional()
    .describe(
      "UUID gerado pelo cliente para tornar a requisição idempotente. Repetir o mesmo " +
        "valor com o mesmo payload não debita outro crédito. Se omitido, a API gera um " +
        "automaticamente."
    ),
});

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { GenerateContentRequestSchema } from "./schemas/generate-content-request.schema.js";
import { GenerateContentResponseSchema } from "./schemas/generate-content-response.schema.js";
import { GenerateContentHeadersSchema } from "./schemas/generate-content-headers.schema.js";
import { ContentIdParamSchema } from "./schemas/content-id-param.schema.js";
import { ContentResponseSchema } from "./schemas/content-response.schema.js";
import { CancelContentResponseSchema } from "./schemas/cancel-content-response.schema.js";
import { ErrorResponseSchema } from "./schemas/error-response.schema.js";
import type { ContentRoutesDependencies } from "./content-routes-dependencies.interface.js";

const TAGS = ["Content"];

export function createContentRoutes(deps: ContentRoutesDependencies): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      "/generate",
      {
        schema: {
          tags: TAGS,
          summary: "Solicita a geração de um novo conteúdo",
          description:
            "Debita 1 crédito do usuário e cria um conteúdo em `PENDING` na mesma " +
            "transação em que enfileira o job de geração. Retorna imediatamente, sem " +
            "esperar o worker processar. Envie um `request-id` para tornar a chamada " +
            "idempotente (repetir a mesma requisição não debita outro crédito).",
          headers: GenerateContentHeadersSchema,
          body: GenerateContentRequestSchema,
          response: {
            201: GenerateContentResponseSchema,
            400: ErrorResponseSchema,
            402: ErrorResponseSchema,
            404: ErrorResponseSchema,
            409: ErrorResponseSchema,
            500: ErrorResponseSchema,
          },
        },
      },
      async (request, reply) => {
        const result = await deps.contentGenerationService.generate({
          ...request.body,
          requestId: request.id,
        });
        if (result.replayed) reply.header("request-replayed", "true");
        return reply.code(201).send({
          requestId: result.requestId,
          contentId: result.contentId,
          status: result.status,
        });
      }
    );

    app.get(
      "/:id",
      {
        schema: {
          tags: TAGS,
          summary: "Consulta o status de um conteúdo",
          description:
            "Retorna o estado atual (`PENDING`, `PROCESSING`, `COMPLETED`, `CANCELED` ou " +
            "`FAILED`), os dados originais da requisição e a URL do resultado em S3/Minio " +
            "quando `COMPLETED`. Use para fazer polling após `POST /generate`.",
          params: ContentIdParamSchema,
          response: {
            200: ContentResponseSchema,
            400: ErrorResponseSchema,
            404: ErrorResponseSchema,
            500: ErrorResponseSchema,
          },
        },
      },
      async (request) => {
        const content = await deps.contentStatusService.getById(request.params.id);
        return {
          id: content.id,
          requestId: content.requestId,
          userId: content.userId,
          topic: content.topic,
          status: content.status,
          resultUrl: content.resultUrl,
          createdAt: content.createdAt.toISOString(),
          updatedAt: content.updatedAt.toISOString(),
        };
      }
    );

    app.post(
      "/:id/cancel",
      {
        schema: {
          tags: TAGS,
          summary: "Cancela a geração de um conteúdo",
          description:
            "Idempotente: chamar mais de uma vez, ou depois que o conteúdo já chegou a um " +
            "estado terminal, não é erro. `canceled: true` indica que esta chamada aplicou " +
            "a transição para `CANCELED`; `canceled: false` indica que o conteúdo já estava " +
            "cancelado ou já havia concluído/falhado antes do pedido de cancelamento.",
          params: ContentIdParamSchema,
          response: {
            200: CancelContentResponseSchema,
            400: ErrorResponseSchema,
            404: ErrorResponseSchema,
            500: ErrorResponseSchema,
          },
        },
      },
      async (request) => {
        const result = await deps.contentStatusService.cancel(request.params.id);
        return {
          id: result.content.id,
          status: result.content.status,
          canceled: result.canceled,
        };
      }
    );
  };
}

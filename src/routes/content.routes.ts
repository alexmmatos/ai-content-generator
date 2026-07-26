import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { GenerateContentRequestSchema } from "../schemas/generate-content-request.schema.js";
import { GenerateContentResponseSchema } from "../schemas/generate-content-response.schema.js";
import { GenerateContentHeadersSchema } from "../schemas/generate-content-headers.schema.js";
import { ContentIdParamSchema } from "../schemas/content-id-param.schema.js";
import { ContentResponseSchema } from "../schemas/content-response.schema.js";
import { CancelContentResponseSchema } from "../schemas/cancel-content-response.schema.js";
import { ErrorResponseSchema } from "../schemas/error-response.schema.js";
import type { ContentRoutesDependencies } from "../types/content-routes-dependencies.interface.js";

export function createContentRoutes(deps: ContentRoutesDependencies): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      "/generate",
      {
        schema: {
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

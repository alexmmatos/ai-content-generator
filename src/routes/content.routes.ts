import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  GenerateContentRequestSchema,
  GenerateContentResponseSchema,
  ContentIdParamSchema,
  ContentResponseSchema,
  CancelContentResponseSchema,
  ErrorResponseSchema,
} from "../schemas/content.schema.js";
import type { ContentGenerationService } from "../services/content-generation.service.js";
import type { ContentStatusService } from "../services/content-status.service.js";

export interface ContentRoutesDependencies {
  contentGenerationService: ContentGenerationService;
  contentStatusService: ContentStatusService;
}

export function createContentRoutes(deps: ContentRoutesDependencies): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      "/generate",
      {
        schema: {
          body: GenerateContentRequestSchema,
          response: {
            201: GenerateContentResponseSchema,
            400: ErrorResponseSchema,
            402: ErrorResponseSchema,
            404: ErrorResponseSchema,
          },
        },
      },
      async (request, reply) => {
        const result = await deps.contentGenerationService.generate(request.body);
        return reply.code(201).send(result);
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
          },
        },
      },
      async (request) => {
        const content = await deps.contentStatusService.getById(request.params.id);
        return {
          id: content.id,
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
          },
        },
      },
      async (request) => {
        const content = await deps.contentStatusService.cancel(request.params.id);
        return { id: content.id, status: content.status };
      }
    );
  };
}

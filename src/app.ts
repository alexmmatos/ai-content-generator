import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createContentRoutes } from "./routes/content.routes.js";
import type { AppDependencies } from "./types/app/app-dependencies.type.js";
import { InsufficientCreditsError } from "./services/generation/insufficient-credits.error.js";
import { ContentNotFoundError } from "./services/status/content-not-found.error.js";
import { UserNotFoundError } from "./services/generation/user-not-found.error.js";
import { RequestIdConflictError } from "./services/generation/request-id-conflict.error.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BuildAppOptions {
  logger?: boolean;
}

export function buildApp(
  deps: AppDependencies,
  options: BuildAppOptions = {}
): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
    requestIdHeader: false,
    genReqId(rawRequest) {
      const received = rawRequest.headers["request-id"];
      return typeof received === "string" && UUID_PATTERN.test(received)
        ? received
        : randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook("onSend", async (request, reply) => {
    reply.header("request-id", request.id);
  });

  app.register(swagger, {
    openapi: {
      info: { title: "AI Content Generator API", version: "1.0.0" },
    },
    transform: jsonSchemaTransform,
  });
  app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(createContentRoutes(deps), { prefix: "/api/content" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof InsufficientCreditsError) {
      return reply.code(402).send({ error: "Insufficient credits" });
    }
    if (error instanceof ContentNotFoundError) {
      return reply.code(404).send({ error: "Content not found" });
    }
    if (error instanceof UserNotFoundError) {
      return reply.code(404).send({ error: "User not found" });
    }
    if (error instanceof RequestIdConflictError) {
      return reply
        .code(409)
        .send({ error: "Request ID already used with a different payload" });
    }
    if (error.code === "FST_ERR_VALIDATION") {
      return reply.code(400).send({ error: "Validation error", details: error.message });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Internal Server Error" });
  });

  return app;
}

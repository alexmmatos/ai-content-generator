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
import type { AppDependencies } from "./types/app-dependencies.js";
import { InsufficientCreditsError } from "./services/insufficient-credits.error.js";
import { ContentNotFoundError } from "./services/content-not-found.error.js";
import { UserNotFoundError } from "./services/user-not-found.error.js";

export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
    if (error.code === "FST_ERR_VALIDATION") {
      // fastify-type-provider-zod throws the raw ZodError (statusCode 400, code
      // FST_ERR_VALIDATION) instead of populating Fastify's usual `error.validation`.
      return reply.code(400).send({ error: "Validation error", details: error.message });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Internal Server Error" });
  });

  return app;
}

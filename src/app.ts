import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createContentRoutes, type ContentRoutesDependencies } from "./routes/content.routes.js";
import { InsufficientCreditsError, ContentNotFoundError } from "./services/errors.js";

export type AppDependencies = ContentRoutesDependencies;

export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get("/health", async () => ({ status: "ok" }));

  app.register(createContentRoutes(deps), { prefix: "/api/content" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof InsufficientCreditsError) {
      return reply.code(402).send({ error: "Insufficient credits" });
    }
    if (error instanceof ContentNotFoundError) {
      return reply.code(404).send({ error: "Content not found" });
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

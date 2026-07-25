import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createContentRoutes, type ContentRoutesDependencies } from "./routes/content.routes.js";

export type AppDependencies = ContentRoutesDependencies;

export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get("/health", async () => ({ status: "ok" }));

  app.register(createContentRoutes(deps), { prefix: "/api/content" });

  return app;
}

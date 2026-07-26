import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { ApiEnv } from "../types/env/api-env.type.js";
import { prisma } from "../lib/prisma.js";
import { PrismaContentRepository } from "../repositories/content.repository.js";
import { PrismaGenerationRequestRepository } from "../repositories/generation-request.repository.js";
import { ContentGenerationService } from "../services/generation/content-generation.service.js";
import { ContentStatusService } from "../services/status/content-status.service.js";

export function createApiRuntime(_config: ApiEnv): FastifyInstance {
  const contentRepository = new PrismaContentRepository();

  const app = buildApp({
    contentGenerationService: new ContentGenerationService(
      new PrismaGenerationRequestRepository()
    ),
    contentStatusService: new ContentStatusService(contentRepository),
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}

import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { ApiEnv } from "../shared/env/api-env.type.js";
import { prisma } from "../shared/db/prisma.js";
import { PrismaContentRepository } from "../features/content-generation/infrastructure/persistence/content.repository.js";
import { PrismaGenerationRequestRepository } from "../features/content-generation/infrastructure/persistence/generation-request.repository.js";
import { ContentGenerationService } from "../features/content-generation/application/generate-content.service.js";
import { ContentStatusService } from "../features/content-generation/application/content-status.service.js";

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

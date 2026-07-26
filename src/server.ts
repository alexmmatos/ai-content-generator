import { env } from "./lib/env.js";
import { buildApp } from "./app.js";
import { PrismaContentRepository } from "./repositories/content.repository.js";
import { PrismaGenerationRequestRepository } from "./repositories/generation-request.repository.js";
import { ContentGenerationService } from "./services/content-generation.service.js";
import { ContentStatusService } from "./services/content-status.service.js";

const contentRepository = new PrismaContentRepository();

const app = buildApp({
  contentGenerationService: new ContentGenerationService(
    new PrismaGenerationRequestRepository()
  ),
  contentStatusService: new ContentStatusService(contentRepository),
});

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

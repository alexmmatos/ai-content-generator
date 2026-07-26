import type { ContentGenerationService } from "../../services/generation/content-generation.service.js";
import type { ContentStatusService } from "../../services/status/content-status.service.js";

export interface ContentRoutesDependencies {
  contentGenerationService: ContentGenerationService;
  contentStatusService: ContentStatusService;
}

import type { ContentGenerationService } from "../services/content-generation.service.js";
import type { ContentStatusService } from "../services/content-status.service.js";

export interface ContentRoutesDependencies {
  contentGenerationService: ContentGenerationService;
  contentStatusService: ContentStatusService;
}

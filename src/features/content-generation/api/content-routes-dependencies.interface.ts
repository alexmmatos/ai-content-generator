import type { ContentGenerationService } from "../application/generate-content.service.js";
import type { ContentStatusService } from "../application/content-status.service.js";

export interface ContentRoutesDependencies {
  contentGenerationService: ContentGenerationService;
  contentStatusService: ContentStatusService;
}

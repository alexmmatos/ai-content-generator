import type { ContentStatusService } from "../../application/content-status.service.js";
import type { ContentStorage } from "../../application/ports/content-storage.interface.js";

export interface ProcessJobDeps {
  statusService: ContentStatusService;
  simulateAiCall: (topic: string) => Promise<string>;
  contentStorage: ContentStorage;
}

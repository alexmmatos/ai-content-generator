import type { ContentStatusService } from "../services/content-status.service.js";
import type { ContentStorage } from "./content-storage.interface.js";

export interface ProcessJobDeps {
  statusService: ContentStatusService;
  simulateAiCall: (topic: string) => Promise<string>;
  contentStorage: ContentStorage;
}

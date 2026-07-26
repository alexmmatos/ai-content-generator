import type { ContentStatusService } from "../../services/status/content-status.service.js";
import type { ContentStorage } from "../storage/content-storage.interface.js";

export interface ProcessJobDeps {
  statusService: ContentStatusService;
  simulateAiCall: (topic: string) => Promise<string>;
  contentStorage: ContentStorage;
}

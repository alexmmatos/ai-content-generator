import type { ContentStatusService } from "../services/content-status.service.js";

export interface ProcessJobDeps {
  statusService: ContentStatusService;
  simulateAiCall: (topic: string) => Promise<string>;
  uploadContentFile: (contentId: string, text: string) => Promise<string>;
}

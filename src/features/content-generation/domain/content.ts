import type { ContentStatus } from "./content-status.js";

export interface ContentEntity {
  id: string;
  requestId: string;
  requestHash: string;
  userId: string;
  topic: string;
  status: ContentStatus;
  resultUrl: string | null;
  cancellationRequestedAt: Date | null;
  terminalAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

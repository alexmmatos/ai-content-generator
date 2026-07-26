export const CONTENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELED",
  "FAILED",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

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

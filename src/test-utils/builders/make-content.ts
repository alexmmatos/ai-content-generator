import type { ContentEntity } from "../../domain/content/content.js";

export function makeContent(overrides: Partial<ContentEntity> = {}): ContentEntity {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    requestHash: "request-hash",
    userId: crypto.randomUUID(),
    topic: "topic",
    status: "PENDING",
    resultUrl: null,
    cancellationRequestedAt: null,
    terminalAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

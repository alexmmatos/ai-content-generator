import type { Content } from "@prisma/client";

export function makeContent(overrides: Partial<Content> = {}): Content {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    requestHash: "request-hash",
    userId: crypto.randomUUID(),
    topic: "topic",
    status: "PENDING",
    resultUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

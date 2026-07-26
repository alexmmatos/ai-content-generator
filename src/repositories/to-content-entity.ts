import type { Content } from "@prisma/client";
import type { ContentEntity } from "../domain/content/content.js";

export function toContentEntity(content: Content): ContentEntity {
  return {
    id: content.id,
    requestId: content.requestId,
    requestHash: content.requestHash,
    userId: content.userId,
    topic: content.topic,
    status: content.status,
    resultUrl: content.resultUrl,
    cancellationRequestedAt: content.cancellationRequestedAt,
    terminalAt: content.terminalAt,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  };
}

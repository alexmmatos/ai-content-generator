import type { ContentEntity, ContentStatus } from "../domain/content.js";

export interface ContentRepository {
  create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<ContentEntity>;
  findById(id: string): Promise<ContentEntity | null>;
  updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<ContentEntity, "status" | "resultUrl">>
  ): Promise<ContentEntity | null>;
  markCompleted(id: string, resultUrl: string): Promise<ContentEntity | null>;
  markFailed(id: string): Promise<ContentEntity | null>;
  cancelWithPriority(
    id: string
  ): Promise<{ content: ContentEntity; canceled: boolean } | null>;
}

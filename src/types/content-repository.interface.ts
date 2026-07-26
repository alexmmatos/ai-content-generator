import type { Content, ContentStatus } from "@prisma/client";

export interface ContentRepository {
  create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<Content>;
  findById(id: string): Promise<Content | null>;
  updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<Content, "status" | "resultUrl">>
  ): Promise<Content | null>;
}

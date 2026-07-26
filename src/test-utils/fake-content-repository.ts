import type { Content, ContentStatus } from "@prisma/client";
import type { ContentRepository } from "../types/content-repository.interface.js";
import { makeContent } from "./make-content.js";

export class FakeContentRepository implements ContentRepository {
  private contents = new Map<string, Content>();

  seed(content: Content): this {
    this.contents.set(content.id, content);
    return this;
  }

  findByRequestIdSync(requestId: string): Content | null {
    return (
      [...this.contents.values()].find((content) => content.requestId === requestId) ?? null
    );
  }

  async create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<Content> {
    const content = makeContent(input);
    this.contents.set(content.id, content);
    return content;
  }

  async findById(id: string): Promise<Content | null> {
    return this.contents.get(id) ?? null;
  }

  async updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<Content, "status" | "resultUrl">>
  ): Promise<Content | null> {
    const content = this.contents.get(id);
    if (!content) return null;
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statuses.includes(content.status)) return null;
    const updated: Content = { ...content, ...data, updatedAt: new Date() };
    this.contents.set(id, updated);
    return updated;
  }
}

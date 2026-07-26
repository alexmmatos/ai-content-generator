import type { ContentEntity } from "../domain/content.js";
import type { ContentStatus } from "../domain/content-status.js";
import type { ContentRepository } from "../types/content-repository.interface.js";
import { makeContent } from "./make-content.js";

export class FakeContentRepository implements ContentRepository {
  private contents = new Map<string, ContentEntity>();

  seed(content: ContentEntity): this {
    this.contents.set(content.id, content);
    return this;
  }

  findByRequestIdSync(requestId: string): ContentEntity | null {
    return (
      [...this.contents.values()].find((content) => content.requestId === requestId) ?? null
    );
  }

  async create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<ContentEntity> {
    const content = makeContent(input);
    this.contents.set(content.id, content);
    return content;
  }

  async findById(id: string): Promise<ContentEntity | null> {
    return this.contents.get(id) ?? null;
  }

  async updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<ContentEntity, "status" | "resultUrl">>
  ): Promise<ContentEntity | null> {
    const content = this.contents.get(id);
    if (!content) return null;
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statuses.includes(content.status)) return null;
    const updated: ContentEntity = { ...content, ...data, updatedAt: new Date() };
    this.contents.set(id, updated);
    return updated;
  }

  async markCompleted(id: string, resultUrl: string): Promise<ContentEntity | null> {
    const completed = await this.updateStatusIf(id, "PROCESSING", {
      status: "COMPLETED",
      resultUrl,
    });
    if (!completed) return null;
    const updated = { ...completed, terminalAt: new Date() };
    this.contents.set(id, updated);
    return updated;
  }

  async markFailed(id: string): Promise<ContentEntity | null> {
    const failed = await this.updateStatusIf(id, ["PENDING", "PROCESSING"], {
      status: "FAILED",
    });
    if (!failed) return null;
    const updated = { ...failed, terminalAt: new Date() };
    this.contents.set(id, updated);
    return updated;
  }

  async cancelWithPriority(
    id: string
  ): Promise<{ content: ContentEntity; canceled: boolean } | null> {
    const content = this.contents.get(id);
    if (!content) return null;
    if (!["PENDING", "PROCESSING"].includes(content.status)) {
      return { content, canceled: false };
    }

    const requestedAt = new Date();
    const canceled: ContentEntity = {
      ...content,
      status: "CANCELED",
      resultUrl: null,
      cancellationRequestedAt: requestedAt,
      terminalAt: requestedAt,
      updatedAt: requestedAt,
    };
    this.contents.set(id, canceled);
    return { content: canceled, canceled: true };
  }
}

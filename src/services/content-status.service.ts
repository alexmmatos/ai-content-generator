import type { ContentEntity } from "../domain/content.js";
import type { ContentRepository } from "../types/content-repository.interface.js";
import { ContentNotFoundError } from "./content-not-found.error.js";

export class ContentStatusService {
  constructor(private contents: ContentRepository) {}

  async getById(id: string): Promise<ContentEntity> {
    const content = await this.contents.findById(id);
    if (!content) throw new ContentNotFoundError();
    return content;
  }

  async findById(id: string): Promise<ContentEntity | null> {
    return this.contents.findById(id);
  }

  async cancel(id: string): Promise<{ content: ContentEntity; canceled: boolean }> {
    const result = await this.contents.cancelWithPriority(id);
    if (!result) throw new ContentNotFoundError();
    return result;
  }

  async markProcessing(id: string): Promise<ContentEntity | null> {
    return this.contents.updateStatusIf(id, ["PENDING", "PROCESSING"], {
      status: "PROCESSING",
    });
  }

  async markCompleted(id: string, resultUrl: string): Promise<ContentEntity | null> {
    return this.contents.markCompleted(id, resultUrl);
  }

  async finalizeFailure(
    id: string
  ): Promise<"marked_failed" | "already_terminal" | "retry_required"> {
    const failed = await this.contents.markFailed(id);
    if (failed) return "marked_failed";

    const current = await this.contents.findById(id);
    if (!current || ["CANCELED", "COMPLETED", "FAILED"].includes(current.status)) {
      return "already_terminal";
    }
    return "retry_required";
  }

  async markFailed(id: string): Promise<ContentEntity | null> {
    const result = await this.finalizeFailure(id);
    if (result !== "marked_failed") return null;
    return this.contents.findById(id);
  }
}

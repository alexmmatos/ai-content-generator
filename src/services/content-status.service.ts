import type { Content, ContentStatus } from "@prisma/client";
import type { ContentRepository } from "../types/content-repository.interface.js";
import { ContentNotFoundError } from "./content-not-found.error.js";

const CANCELABLE_STATUSES: ContentStatus[] = ["PENDING", "PROCESSING"];

export class ContentStatusService {
  constructor(private contents: ContentRepository) {}

  async getById(id: string): Promise<Content> {
    const content = await this.contents.findById(id);
    if (!content) throw new ContentNotFoundError();
    return content;
  }

  async cancel(id: string): Promise<Content> {
    const canceled = await this.contents.updateStatusIf(id, CANCELABLE_STATUSES, {
      status: "CANCELED",
    });
    if (canceled) return canceled;

    return this.getById(id);
  }

  async markProcessing(id: string): Promise<Content | null> {
    return this.contents.updateStatusIf(id, ["PENDING", "PROCESSING"], {
      status: "PROCESSING",
    });
  }

  async markCompleted(id: string, resultUrl: string): Promise<Content | null> {
    return this.contents.updateStatusIf(id, "PROCESSING", {
      status: "COMPLETED",
      resultUrl,
    });
  }

  async markFailed(id: string): Promise<Content | null> {
    return this.contents.updateStatusIf(id, "PROCESSING", { status: "FAILED" });
  }
}

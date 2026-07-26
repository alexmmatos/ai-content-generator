import type { Content, ContentStatus } from "@prisma/client";
import type { ContentRepository } from "../types/content-repository.js";
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

    // Not PENDING/PROCESSING anymore (already terminal) or doesn't exist — either way
    // this is not a check-then-write race: the conditional update above already tried
    // atomically. Look up the current state to answer idempotently.
    return this.getById(id);
  }

  async markProcessing(id: string): Promise<Content | null> {
    // Accepting PROCESSING as a starting state (not just PENDING) is required: it's what
    // makes a BullMQ retry (2nd+ attempt, status already PROCESSING since the 1st) not
    // get treated as "canceled" — see spec 05.
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

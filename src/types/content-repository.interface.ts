import type { Content, ContentStatus } from "@prisma/client";

export interface ContentRepository {
  create(input: { userId: string; topic: string }): Promise<Content>;
  findById(id: string): Promise<Content | null>;
  /** Conditional UPDATE: only applies if the current status is in `expectedStatus` (a
   *  single status or a list — markProcessing needs to accept PENDING *and* PROCESSING,
   *  see ContentStatusService). Returns the updated record, or null if the condition
   *  didn't match (e.g. already CANCELED). This is the only primitive the /cancel route
   *  and the worker use to write status, so they never step on each other — see
   *  .claude/rules/business-rules.md. */
  updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<Content, "status" | "resultUrl">>
  ): Promise<Content | null>;
}

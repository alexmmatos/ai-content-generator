import type { Content, ContentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface ContentRepository {
  create(input: { userId: string; topic: string }): Promise<Content>;
  findById(id: string): Promise<Content | null>;
  /** Conditional UPDATE: only applies if the current status is in `expectedStatus` (a
   *  single status or a list — markProcessing needs to accept PENDING *and* PROCESSING,
   *  see spec 04). Returns the updated record, or null if the condition didn't match
   *  (e.g. already CANCELED). This is the only primitive the /cancel route and the
   *  worker use to write status, so they never step on each other — see
   *  .claude/rules/business-rules.md. */
  updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<Content, "status" | "resultUrl">>
  ): Promise<Content | null>;
}

export class PrismaContentRepository implements ContentRepository {
  async create(input: { userId: string; topic: string }): Promise<Content> {
    return prisma.content.create({ data: input });
  }

  async findById(id: string): Promise<Content | null> {
    return prisma.content.findUnique({ where: { id } });
  }

  async updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<Content, "status" | "resultUrl">>
  ): Promise<Content | null> {
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const result = await prisma.content.updateMany({
      where: { id, status: { in: statuses } },
      data,
    });
    if (result.count !== 1) return null;
    return prisma.content.findUnique({ where: { id } });
  }
}

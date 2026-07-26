import type { Content, ContentStatus } from "@prisma/client";
import type { ContentRepository } from "../types/content-repository.interface.js";
import { prisma } from "../lib/prisma.js";

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

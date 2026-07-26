import { prisma } from "../lib/prisma.js";
import type {
  OutboxRepository,
  PendingOutboxEvent,
} from "../types/outbox-repository.interface.js";

export class PrismaOutboxRepository implements OutboxRepository {
  async findPending(limit: number): Promise<PendingOutboxEvent[]> {
    return prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        aggregateId: true,
        requestId: true,
      },
    });
  }

  async markPublished(id: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        publishedAt: new Date(),
        lastError: null,
      },
    });
  }

  async recordFailure(id: string, error: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastError: error,
      },
    });
  }
}

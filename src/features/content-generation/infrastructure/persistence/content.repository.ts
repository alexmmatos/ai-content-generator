import { Prisma } from "@prisma/client";
import type { ContentEntity } from "../../domain/content.js";
import type { ContentStatus } from "../../domain/content-status.js";
import type { ContentRepository } from "../../application/ports/content-repository.interface.js";
import { prisma } from "../../../../shared/db/prisma.js";
import { OUTBOX_NOTIFY_CHANNEL } from "../../../../shared/outbox/outbox-channel.js";
import { toContentEntity } from "./to-content-entity.js";

export class PrismaContentRepository implements ContentRepository {
  async create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<ContentEntity> {
    return toContentEntity(await prisma.content.create({ data: input }));
  }

  async findById(id: string): Promise<ContentEntity | null> {
    const content = await prisma.content.findUnique({ where: { id } });
    return content ? toContentEntity(content) : null;
  }

  async updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<ContentEntity, "status" | "resultUrl">>
  ): Promise<ContentEntity | null> {
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const result = await prisma.content.updateMany({
      where: { id, status: { in: statuses } },
      data,
    });
    if (result.count !== 1) return null;
    const content = await prisma.content.findUnique({ where: { id } });
    return content ? toContentEntity(content) : null;
  }

  async markCompleted(id: string, resultUrl: string): Promise<ContentEntity | null> {
    const terminalAt = await databaseNow();
    const result = await prisma.content.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "COMPLETED", resultUrl, terminalAt },
    });
    if (result.count !== 1) return null;
    return this.findById(id);
  }

  async markFailed(id: string): Promise<ContentEntity | null> {
    const terminalAt = await databaseNow();
    const result = await prisma.content.updateMany({
      where: { id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", terminalAt },
    });
    if (result.count !== 1) return null;
    return this.findById(id);
  }

  async cancelWithPriority(
    id: string
  ): Promise<{ content: ContentEntity; canceled: boolean } | null> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ requestedAt: Date }>>(
        Prisma.sql`SELECT transaction_timestamp() AS "requestedAt"`
      );
      const requestedAt = rows[0]?.requestedAt;
      if (!requestedAt) throw new Error("Could not obtain cancellation timestamp");

      const updated = await tx.content.updateMany({
        where: {
          id,
          OR: [
            { status: { in: ["PENDING", "PROCESSING"] } },
            {
              status: { in: ["COMPLETED", "FAILED"] },
              terminalAt: { gte: requestedAt },
            },
          ],
        },
        data: {
          status: "CANCELED",
          resultUrl: null,
          cancellationRequestedAt: requestedAt,
          terminalAt: requestedAt,
        },
      });

      if (updated.count !== 1) {
        const current = await tx.content.findUnique({ where: { id } });
        return current
          ? { content: toContentEntity(current), canceled: false }
          : null;
      }

      const content = await tx.content.findUniqueOrThrow({ where: { id } });
      await tx.outboxEvent.upsert({
        where: {
          type_aggregateId: {
            type: "CONTENT_CANCELLATION_REQUESTED",
            aggregateId: id,
          },
        },
        create: {
          type: "CONTENT_CANCELLATION_REQUESTED",
          aggregateId: id,
          requestId: content.requestId,
          payload: { contentId: id, requestId: content.requestId },
        },
        update: {},
      });

      await tx.$executeRaw`SELECT pg_notify(${OUTBOX_NOTIFY_CHANNEL}, '')`;

      return { content: toContentEntity(content), canceled: true };
    });
  }
}

async function databaseNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>(
    Prisma.sql`SELECT clock_timestamp() AS "now"`
  );
  const now = rows[0]?.now;
  if (!now) throw new Error("Could not obtain database timestamp");
  return now;
}

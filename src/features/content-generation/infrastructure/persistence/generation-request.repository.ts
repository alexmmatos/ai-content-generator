import { Prisma, type Content } from "@prisma/client";
import { prisma } from "../../../../shared/db/prisma.js";
import { OUTBOX_NOTIFY_CHANNEL } from "../../../../shared/outbox/outbox-channel.js";
import { toContentEntity } from "./to-content-entity.js";
import type { GenerationRequestRepository } from "../../application/ports/generation-request-repository.interface.js";
import type { CreateGenerationRequestResult } from "../../application/ports/create-generation-request-result.type.js";

class InsufficientCreditsPersistenceError extends Error {}

export class PrismaGenerationRequestRepository implements GenerationRequestRepository {
  async create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<CreateGenerationRequestResult> {
    const existing = await prisma.content.findUnique({
      where: { requestId: input.requestId },
    });
    if (existing) return { kind: "duplicate", content: toContentEntity(existing) };

    try {
      const createdRequest = await prisma.$transaction(async (tx): Promise<{
        content: Content;
        outboxEventId: string;
      } | null> => {
        const user = await tx.user.findUnique({ where: { id: input.userId } });
        if (!user) return null;

        const created = await tx.content.create({
          data: {
            requestId: input.requestId,
            requestHash: input.requestHash,
            userId: input.userId,
            topic: input.topic,
          },
        });

        const debit = await tx.user.updateMany({
          where: { id: input.userId, credits: { gt: 0 } },
          data: { credits: { decrement: 1 } },
        });
        if (debit.count !== 1) throw new InsufficientCreditsPersistenceError();

        const outboxEvent = await tx.outboxEvent.create({
          data: {
            type: "CONTENT_GENERATION_REQUESTED",
            aggregateId: created.id,
            requestId: input.requestId,
            payload: {
              contentId: created.id,
              requestId: input.requestId,
            },
          },
        });

        await tx.$executeRaw`SELECT pg_notify(${OUTBOX_NOTIFY_CHANNEL}, '')`;

        return {
          content: created,
          outboxEventId: outboxEvent.id,
        };
      });

      if (!createdRequest) return { kind: "user_not_found" };
      return {
        kind: "created",
        content: toContentEntity(createdRequest.content),
        outboxEventId: createdRequest.outboxEventId,
      };
    } catch (error) {
      if (error instanceof InsufficientCreditsPersistenceError) {
        return { kind: "insufficient_credits" };
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.content.findUnique({
          where: { requestId: input.requestId },
        });
        if (duplicate) {
          return { kind: "duplicate", content: toContentEntity(duplicate) };
        }
      }

      throw error;
    }
  }
}

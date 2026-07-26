import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { createGenerationRequestHash } from "../services/generation/create-generation-request-hash.js";
import { PrismaGenerationRequestRepository } from "./generation-request.repository.js";

describe("PrismaGenerationRequestRepository transaction (real Postgres)", () => {
  it("creates one content, one outbox event and one debit for concurrent replays", async () => {
    const requests = new PrismaGenerationRequestRepository();
    const user = await prisma.user.create({ data: { credits: 2 } });
    const requestId = randomUUID();
    const topic = "idempotência concorrente";
    const input = {
      requestId,
      requestHash: createGenerationRequestHash({ userId: user.id, topic }),
      userId: user.id,
      topic,
    };

    try {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => requests.create(input))
      );

      expect(results.filter((result) => result.kind === "created")).toHaveLength(1);
      expect(results.filter((result) => result.kind === "duplicate")).toHaveLength(9);
      expect(await prisma.content.count({ where: { requestId } })).toBe(1);
      expect(await prisma.outboxEvent.count({ where: { requestId } })).toBe(1);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits).toBe(
        1
      );
    } finally {
      await prisma.outboxEvent.deleteMany({ where: { requestId } });
      await prisma.content.deleteMany({ where: { requestId } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("rolls back content and outbox when the debit cannot be made", async () => {
    const requests = new PrismaGenerationRequestRepository();
    const user = await prisma.user.create({ data: { credits: 0 } });
    const requestId = randomUUID();
    const topic = "sem crédito";

    try {
      const result = await requests.create({
        requestId,
        requestHash: createGenerationRequestHash({ userId: user.id, topic }),
        userId: user.id,
        topic,
      });

      expect(result).toEqual({ kind: "insufficient_credits" });
      expect(await prisma.content.count({ where: { requestId } })).toBe(0);
      expect(await prisma.outboxEvent.count({ where: { requestId } })).toBe(0);
    } finally {
      await prisma.outboxEvent.deleteMany({ where: { requestId } });
      await prisma.content.deleteMany({ where: { requestId } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

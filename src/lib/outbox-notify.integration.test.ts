import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import { OUTBOX_NOTIFY_CHANNEL } from "./outbox-channel.js";
import { createGenerationRequestHash } from "../services/content-generation.service.js";
import { PrismaGenerationRequestRepository } from "../repositories/generation-request.repository.js";

// Well below OUTBOX_POLL_INTERVAL_MS's default of 1000ms — proves NOTIFY woke the
// listener rather than the test happening to win a race against a fast poll tick.
const LATENCY_BUDGET_MS = 200;

async function waitForNotification(client: Client, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    client.once("notification", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

describe("Postgres NOTIFY on outbox commit (real Postgres)", () => {
  let listener: Client;

  afterEach(async () => {
    await listener?.end();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("delivers a notification well below the poll interval when the transaction commits", async () => {
    listener = new Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    await listener.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    const received = waitForNotification(listener, LATENCY_BUDGET_MS);

    const requests = new PrismaGenerationRequestRepository();
    const user = await prisma.user.create({ data: { credits: 1 } });
    const requestId = randomUUID();
    const topic = "notificação rápida";

    try {
      await requests.create({
        requestId,
        requestHash: createGenerationRequestHash({ userId: user.id, topic }),
        userId: user.id,
        topic,
      });

      await expect(received).resolves.toBe(true);
    } finally {
      await prisma.outboxEvent.deleteMany({ where: { requestId } });
      await prisma.content.deleteMany({ where: { requestId } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("never notifies when the transaction rolls back for insufficient credits", async () => {
    listener = new Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    await listener.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    const received = waitForNotification(listener, LATENCY_BUDGET_MS);

    const requests = new PrismaGenerationRequestRepository();
    const user = await prisma.user.create({ data: { credits: 0 } });
    const requestId = randomUUID();
    const topic = "sem crédito, sem notificação";

    try {
      const result = await requests.create({
        requestId,
        requestHash: createGenerationRequestHash({ userId: user.id, topic }),
        userId: user.id,
        topic,
      });

      expect(result).toEqual({ kind: "insufficient_credits" });
      await expect(received).resolves.toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("still delivers the event via polling if no listener was active at commit time", async () => {
    const requests = new PrismaGenerationRequestRepository();
    const user = await prisma.user.create({ data: { credits: 1 } });
    const requestId = randomUUID();
    const topic = "fallback via polling";

    try {
      const created = await requests.create({
        requestId,
        requestHash: createGenerationRequestHash({ userId: user.id, topic }),
        userId: user.id,
        topic,
      });
      if (created.kind !== "created") throw new Error("expected content to be created");

      const event = await prisma.outboxEvent.findFirst({
        where: { aggregateId: created.content.id },
      });

      expect(event).not.toBeNull();
      expect(event?.publishedAt).toBeNull();
    } finally {
      await prisma.outboxEvent.deleteMany({ where: { requestId } });
      await prisma.content.deleteMany({ where: { requestId } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

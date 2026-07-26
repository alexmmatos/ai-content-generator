import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  outboxEvent: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { PrismaOutboxRepository } from "./outbox.repository.js";

describe("PrismaOutboxRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads pending events in creation order with a limit", async () => {
    const events = [
      {
        id: "event-1",
        type: "CONTENT_GENERATION_REQUESTED",
        aggregateId: "content-1",
        requestId: "request-1",
        payload: {},
      },
    ];
    prismaMock.outboxEvent.findMany.mockResolvedValue(events);

    const result = await new PrismaOutboxRepository().findPending(25);

    expect(result).toBe(events);
    expect(prismaMock.outboxEvent.findMany).toHaveBeenCalledWith({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: 25,
      select: {
        id: true,
        type: true,
        aggregateId: true,
        requestId: true,
        payload: true,
      },
    });
  });

  it("marks an event as published and clears its last error", async () => {
    prismaMock.outboxEvent.update.mockResolvedValue({});

    await new PrismaOutboxRepository().markPublished("event-1");

    expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: {
        publishedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it("increments attempts and stores the last publication error", async () => {
    prismaMock.outboxEvent.update.mockResolvedValue({});

    await new PrismaOutboxRepository().recordFailure("event-1", "Redis unavailable");

    expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: {
        attempts: { increment: 1 },
        lastError: "Redis unavailable",
      },
    });
  });
});

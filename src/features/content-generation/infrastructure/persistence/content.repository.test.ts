import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaContentRepository } from "./content.repository.js";
import { makeContent } from "../../test-utils/builders/make-content.js";

const prismaMock = vi.hoisted(() => ({
  content: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  outboxEvent: {
    upsert: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("../../../../shared/db/prisma.js", () => ({ prisma: prismaMock }));

describe("PrismaContentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (operation: (tx: typeof prismaMock) => unknown) => operation(prismaMock)
    );
    prismaMock.$executeRaw.mockResolvedValue(undefined);
  });

  it("creates content with the supplied input", async () => {
    const content = makeContent({ userId: "user-1", topic: "gatos" });
    prismaMock.content.create.mockResolvedValue(content);

    const result = await new PrismaContentRepository().create({
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requestHash: "hash",
      userId: "user-1",
      topic: "gatos",
    });

    expect(result).toStrictEqual(content);
    expect(prismaMock.content.create).toHaveBeenCalledWith({
      data: {
        requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestHash: "hash",
        userId: "user-1",
        topic: "gatos",
      },
    });
  });

  it("finds content by id", async () => {
    const content = makeContent({ id: "content-1" });
    prismaMock.content.findUnique.mockResolvedValue(content);

    const result = await new PrismaContentRepository().findById("content-1");

    expect(result).toStrictEqual(content);
    expect(prismaMock.content.findUnique).toHaveBeenCalledWith({
      where: { id: "content-1" },
    });
  });

  it("returns null when content does not exist", async () => {
    prismaMock.content.findUnique.mockResolvedValue(null);

    await expect(
      new PrismaContentRepository().findById("missing-content")
    ).resolves.toBeNull();
  });

  it("updates from a single expected status and returns the updated content", async () => {
    const content = makeContent({ id: "content-1", status: "PROCESSING" });
    prismaMock.content.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.content.findUnique.mockResolvedValue(content);

    const result = await new PrismaContentRepository().updateStatusIf(
      "content-1",
      "PENDING",
      { status: "PROCESSING" }
    );

    expect(result).toStrictEqual(content);
    expect(prismaMock.content.updateMany).toHaveBeenCalledWith({
      where: { id: "content-1", status: { in: ["PENDING"] } },
      data: { status: "PROCESSING" },
    });
    expect(prismaMock.content.findUnique).toHaveBeenCalledWith({
      where: { id: "content-1" },
    });
  });

  it("passes multiple expected statuses to the conditional update", async () => {
    const content = makeContent({ id: "content-1", status: "CANCELED" });
    prismaMock.content.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.content.findUnique.mockResolvedValue(content);

    await new PrismaContentRepository().updateStatusIf(
      "content-1",
      ["PENDING", "PROCESSING"],
      { status: "CANCELED" }
    );

    expect(prismaMock.content.updateMany).toHaveBeenCalledWith({
      where: {
        id: "content-1",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: { status: "CANCELED" },
    });
  });

  it("returns null without a second query when the conditional update changes nothing", async () => {
    prismaMock.content.updateMany.mockResolvedValue({ count: 0 });

    const result = await new PrismaContentRepository().updateStatusIf(
      "content-1",
      "PROCESSING",
      { status: "COMPLETED", resultUrl: "http://example.com/result.txt" }
    );

    expect(result).toBeNull();
    expect(prismaMock.content.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when content disappears after a successful conditional update", async () => {
    prismaMock.content.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.content.findUnique.mockResolvedValue(null);

    await expect(
      new PrismaContentRepository().updateStatusIf("content-1", "PENDING", {
        status: "PROCESSING",
      })
    ).resolves.toBeNull();
  });

  it("marks PROCESSING content completed using the database clock", async () => {
    const now = new Date();
    const content = makeContent({
      id: "content-1",
      status: "COMPLETED",
      resultUrl: "http://storage/result.txt",
      terminalAt: now,
    });
    prismaMock.$queryRaw.mockResolvedValue([{ now }]);
    prismaMock.content.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.content.findUnique.mockResolvedValue(content);

    await expect(
      new PrismaContentRepository().markCompleted(
        "content-1",
        "http://storage/result.txt"
      )
    ).resolves.toStrictEqual(content);

    expect(prismaMock.content.updateMany).toHaveBeenCalledWith({
      where: { id: "content-1", status: "PROCESSING" },
      data: {
        status: "COMPLETED",
        resultUrl: "http://storage/result.txt",
        terminalAt: now,
      },
    });
  });

  it("marks PENDING or PROCESSING content failed and preserves terminal states", async () => {
    const now = new Date();
    prismaMock.$queryRaw.mockResolvedValue([{ now }]);
    prismaMock.content.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prismaMock.content.findUnique.mockResolvedValue(
      makeContent({ id: "content-1", status: "FAILED", terminalAt: now })
    );
    const repository = new PrismaContentRepository();

    await expect(repository.markFailed("content-1")).resolves.toMatchObject({
      status: "FAILED",
    });
    await expect(repository.markFailed("terminal-content")).resolves.toBeNull();

    expect(prismaMock.content.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "content-1",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: { status: "FAILED", terminalAt: now },
    });
  });

  it("returns null when completion loses the cancellation race", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ now: new Date() }]);
    prismaMock.content.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      new PrismaContentRepository().markCompleted("content-1", "http://storage/x.txt")
    ).resolves.toBeNull();
  });

  it("atomically cancels and creates one cleanup outbox event", async () => {
    const requestedAt = new Date();
    const content = makeContent({
      id: "content-1",
      requestId: "request-1",
      status: "CANCELED",
      cancellationRequestedAt: requestedAt,
      terminalAt: requestedAt,
    });
    prismaMock.$queryRaw.mockResolvedValue([{ requestedAt }]);
    prismaMock.content.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.content.findUniqueOrThrow.mockResolvedValue(content);
    prismaMock.outboxEvent.upsert.mockResolvedValue({});

    await expect(
      new PrismaContentRepository().cancelWithPriority("content-1")
    ).resolves.toEqual({ content, canceled: true });

    expect(prismaMock.content.updateMany).toHaveBeenCalledWith({
      where: {
        id: "content-1",
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
    expect(prismaMock.outboxEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type_aggregateId: {
            type: "CONTENT_CANCELLATION_REQUESTED",
            aggregateId: "content-1",
          },
        },
      })
    );
  });

  it.each([
    ["late terminal content", makeContent({ status: "COMPLETED" }), false],
    ["missing content", null, null],
  ])("handles cancellation of %s", async (_name, current, expected) => {
    prismaMock.$queryRaw.mockResolvedValue([{ requestedAt: new Date() }]);
    prismaMock.content.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.content.findUnique.mockResolvedValue(current);

    const result = await new PrismaContentRepository().cancelWithPriority("content-1");

    if (expected === null) expect(result).toBeNull();
    else expect(result).toEqual({ content: current, canceled: expected });
    expect(prismaMock.outboxEvent.upsert).not.toHaveBeenCalled();
  });

  it("fails explicitly when PostgreSQL returns no clock value", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(
      new PrismaContentRepository().markFailed("content-1")
    ).rejects.toThrow("Could not obtain database timestamp");
    await expect(
      new PrismaContentRepository().cancelWithPriority("content-1")
    ).rejects.toThrow("Could not obtain cancellation timestamp");
  });
});

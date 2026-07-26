import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaGenerationRequestRepository } from "./generation-request.repository.js";
import { makeContent } from "../../test-utils/builders/make-content.js";
import { makeUser } from "../../test-utils/builders/make-user.js";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    content: {
      create: vi.fn(),
    },
    outboxEvent: {
      create: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };
  return {
    tx,
    prisma: {
      content: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("../../../../shared/db/prisma.js", () => ({ prisma: mocks.prisma }));

const INPUT = {
  requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requestHash: "hash",
  userId: "user-1",
  topic: "gatos",
};

describe("PrismaGenerationRequestRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.content.findUnique.mockResolvedValue(null);
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx)
    );
    mocks.tx.user.findUnique.mockResolvedValue(makeUser({ id: "user-1" }));
    mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.outboxEvent.create.mockResolvedValue({ id: "outbox-1" });
    mocks.tx.$executeRaw.mockResolvedValue(undefined);
  });

  it("returns an existing request before opening a transaction", async () => {
    const content = makeContent({ requestId: INPUT.requestId });
    mocks.prisma.content.findUnique.mockResolvedValue(content);

    const result = await new PrismaGenerationRequestRepository().create(INPUT);

    expect(result).toEqual({ kind: "duplicate", content });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates content, debits credit and writes the outbox in one transaction", async () => {
    const content = makeContent({
      requestId: INPUT.requestId,
      requestHash: INPUT.requestHash,
      userId: INPUT.userId,
      topic: INPUT.topic,
    });
    mocks.tx.content.create.mockResolvedValue(content);

    const result = await new PrismaGenerationRequestRepository().create(INPUT);

    expect(result).toEqual({
      kind: "created",
      content,
      outboxEventId: "outbox-1",
    });
    expect(mocks.tx.content.create).toHaveBeenCalledWith({
      data: INPUT,
    });
    expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: "CONTENT_GENERATION_REQUESTED",
        aggregateId: content.id,
        requestId: INPUT.requestId,
        payload: {
          contentId: content.id,
          requestId: INPUT.requestId,
        },
      },
    });
  });

  it("returns user_not_found without creating or debiting", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(null);

    const result = await new PrismaGenerationRequestRepository().create(INPUT);

    expect(result).toEqual({ kind: "user_not_found" });
    expect(mocks.tx.content.create).not.toHaveBeenCalled();
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns insufficient_credits and aborts before writing the outbox", async () => {
    mocks.tx.content.create.mockResolvedValue(makeContent());
    mocks.tx.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await new PrismaGenerationRequestRepository().create(INPUT);

    expect(result).toEqual({ kind: "insufficient_credits" });
    expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("resolves a concurrent unique conflict as a duplicate", async () => {
    const duplicate = makeContent({ requestId: INPUT.requestId });
    const conflict = new Prisma.PrismaClientKnownRequestError("unique conflict", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mocks.prisma.content.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(duplicate);
    mocks.prisma.$transaction.mockRejectedValue(conflict);

    const result = await new PrismaGenerationRequestRepository().create(INPUT);

    expect(result).toEqual({ kind: "duplicate", content: duplicate });
  });

  it("rethrows a unique error when no matching request exists", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("unique conflict", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mocks.prisma.$transaction.mockRejectedValue(conflict);

    await expect(
      new PrismaGenerationRequestRepository().create(INPUT)
    ).rejects.toBe(conflict);
  });

  it("rethrows unexpected persistence errors", async () => {
    const failure = new Error("database unavailable");
    mocks.prisma.$transaction.mockRejectedValue(failure);

    await expect(
      new PrismaGenerationRequestRepository().create(INPUT)
    ).rejects.toBe(failure);
  });
});

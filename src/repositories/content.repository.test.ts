import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  content: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { PrismaContentRepository } from "./content.repository.js";
import { makeContent } from "../test-utils/make-content.js";

describe("PrismaContentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates content with the supplied input", async () => {
    const content = makeContent({ userId: "user-1", topic: "gatos" });
    prismaMock.content.create.mockResolvedValue(content);

    const result = await new PrismaContentRepository().create({
      userId: "user-1",
      topic: "gatos",
    });

    expect(result).toBe(content);
    expect(prismaMock.content.create).toHaveBeenCalledWith({
      data: { userId: "user-1", topic: "gatos" },
    });
  });

  it("finds content by id", async () => {
    const content = makeContent({ id: "content-1" });
    prismaMock.content.findUnique.mockResolvedValue(content);

    const result = await new PrismaContentRepository().findById("content-1");

    expect(result).toBe(content);
    expect(prismaMock.content.findUnique).toHaveBeenCalledWith({
      where: { id: "content-1" },
    });
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

    expect(result).toBe(content);
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
});

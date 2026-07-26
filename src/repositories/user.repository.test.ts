import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { PrismaUserRepository } from "./user.repository.js";
import { makeUser } from "../test-utils/make-user.js";

describe("PrismaUserRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds a user by id", async () => {
    const user = makeUser({ id: "user-1" });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await new PrismaUserRepository().findById("user-1");

    expect(result).toBe(user);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });

  it("returns true when the conditional credit decrement updates one user", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await new PrismaUserRepository().decrementCredits("user-1");

    expect(result).toBe(true);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("returns false when no user with available credits is updated", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    expect(await new PrismaUserRepository().decrementCredits("user-1")).toBe(false);
  });
});

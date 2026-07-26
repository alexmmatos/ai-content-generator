import type { User } from "@prisma/client";
import type { UserRepository } from "../types/user-repository.js";
import { prisma } from "../lib/prisma.js";

export class PrismaUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async decrementCredits(id: string): Promise<boolean> {
    const result = await prisma.user.updateMany({
      where: { id, credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
    return result.count === 1;
  }
}

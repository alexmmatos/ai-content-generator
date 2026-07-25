import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** Conditional UPDATE (credits > 0) in a single query — never read then write in
   *  separate steps, see .claude/rules/business-rules.md. Returns false if the user
   *  doesn't exist or had no credit left (0 rows affected). */
  decrementCredits(id: string): Promise<boolean>;
}

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

import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { PrismaUserRepository } from "./user.repository.js";

// Hits the real Postgres from docker-compose (DATABASE_URL) — this is the only way to
// actually prove the conditional UPDATE prevents double-debit under real concurrent
// connections; the in-memory fake used by the rest of the suite has no `await` between
// its check and mutation, so it can't exercise a genuine race the way separate DB
// connections can. Run with `npm run test:integration` (requires `docker-compose up
// postgres` + a migrated schema).

describe("PrismaUserRepository.decrementCredits concurrency (real Postgres)", () => {
  it("with credits = 1, exactly one of N concurrent connections succeeds", async () => {
    const users = new PrismaUserRepository();
    const user = await prisma.user.create({ data: { credits: 1 } });

    try {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => users.decrementCredits(user.id))
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results.filter((r) => !r)).toHaveLength(9);

      const finalUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(finalUser.credits).toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

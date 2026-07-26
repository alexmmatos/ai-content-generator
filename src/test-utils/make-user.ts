import type { User } from "@prisma/client";

export function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    credits: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

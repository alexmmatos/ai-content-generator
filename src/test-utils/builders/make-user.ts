import type { UserEntity } from "../../domain/user/user.js";

export function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    credits: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

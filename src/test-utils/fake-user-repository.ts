import type { User } from "@prisma/client";
import type { UserRepository } from "../types/user-repository.interface.js";

export class FakeUserRepository implements UserRepository {
  private users = new Map<string, User>();

  seed(user: User): this {
    this.users.set(user.id, user);
    return this;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async decrementCredits(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user || user.credits <= 0) return false;
    user.credits -= 1;
    return true;
  }
}

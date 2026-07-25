import type { User, Content, ContentStatus } from "@prisma/client";
import type { UserRepository } from "../repositories/user.repository.js";
import type { ContentRepository } from "../repositories/content.repository.js";

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

export function makeContent(overrides: Partial<Content> = {}): Content {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    topic: "topic",
    status: "PENDING",
    resultUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

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

export class FakeContentRepository implements ContentRepository {
  private contents = new Map<string, Content>();

  seed(content: Content): this {
    this.contents.set(content.id, content);
    return this;
  }

  async create(input: { userId: string; topic: string }): Promise<Content> {
    const content = makeContent(input);
    this.contents.set(content.id, content);
    return content;
  }

  async findById(id: string): Promise<Content | null> {
    return this.contents.get(id) ?? null;
  }

  async updateStatusIf(
    id: string,
    expectedStatus: ContentStatus | ContentStatus[],
    data: Partial<Pick<Content, "status" | "resultUrl">>
  ): Promise<Content | null> {
    const content = this.contents.get(id);
    if (!content) return null;
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!statuses.includes(content.status)) return null;
    const updated: Content = { ...content, ...data, updatedAt: new Date() };
    this.contents.set(id, updated);
    return updated;
  }
}

export class FakeQueue {
  jobs: { name: string; data: unknown }[] = [];

  async add(name: string, data: unknown): Promise<void> {
    this.jobs.push({ name, data });
  }
}

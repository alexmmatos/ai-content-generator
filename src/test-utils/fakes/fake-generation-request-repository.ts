import type { GenerationRequestRepository } from "../../types/repositories/generation-request-repository.interface.js";
import type { CreateGenerationRequestResult } from "../../types/repositories/create-generation-request-result.type.js";
import type { FakeContentRepository } from "./fake-content-repository.js";
import type { FakeUserRepository } from "./fake-user-repository.js";

export class FakeGenerationRequestRepository implements GenerationRequestRepository {
  private inFlight = new Map<string, Promise<CreateGenerationRequestResult>>();

  constructor(
    private users: FakeUserRepository,
    private contents: FakeContentRepository
  ) {}

  create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<CreateGenerationRequestResult> {
    const existing = this.contents.findByRequestIdSync(input.requestId);
    if (existing) return Promise.resolve({ kind: "duplicate", content: existing });

    const active = this.inFlight.get(input.requestId);
    if (active) {
      return active.then((result) =>
        result.kind === "created"
          ? { kind: "duplicate", content: result.content }
          : result
      );
    }

    const operation = this.createOnce(input).finally(() => {
      this.inFlight.delete(input.requestId);
    });
    this.inFlight.set(input.requestId, operation);
    return operation;
  }

  private async createOnce(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<CreateGenerationRequestResult> {
    const user = await this.users.findById(input.userId);
    if (!user) return { kind: "user_not_found" };

    const debited = await this.users.decrementCredits(input.userId);
    if (!debited) return { kind: "insufficient_credits" };

    const content = await this.contents.create(input);
    return {
      kind: "created",
      content,
      outboxEventId: `outbox:${input.requestId}`,
    };
  }
}

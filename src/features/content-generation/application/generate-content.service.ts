import type { ContentStatus } from "../domain/content-status.js";
import type { GenerationRequestRepository } from "./ports/generation-request-repository.interface.js";
import { createGenerationRequestHash } from "./create-generation-request-hash.js";
import { InsufficientCreditsError } from "../domain/errors/insufficient-credits.error.js";
import { RequestIdConflictError } from "../domain/errors/request-id-conflict.error.js";
import { UserNotFoundError } from "../domain/errors/user-not-found.error.js";

export class ContentGenerationService {
  constructor(private requests: GenerationRequestRepository) {}

  async generate(input: {
    requestId: string;
    userId: string;
    topic: string;
  }): Promise<{
    requestId: string;
    contentId: string;
    status: ContentStatus;
    replayed: boolean;
  }> {
    const requestHash = createGenerationRequestHash(input);
    const result = await this.requests.create({ ...input, requestHash });

    if (result.kind === "user_not_found") throw new UserNotFoundError();
    if (result.kind === "insufficient_credits") throw new InsufficientCreditsError();

    if (result.kind === "duplicate") {
      if (result.content.requestHash !== requestHash) throw new RequestIdConflictError();
      return {
        requestId: result.content.requestId,
        contentId: result.content.id,
        status: result.content.status,
        replayed: true,
      };
    }

    return {
      requestId: result.content.requestId,
      contentId: result.content.id,
      status: result.content.status,
      replayed: false,
    };
  }
}

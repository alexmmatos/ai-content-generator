import { createHash } from "node:crypto";
import type { ContentStatus } from "@prisma/client";
import type { GenerationRequestRepository } from "../types/generation-request-repository.interface.js";
import { InsufficientCreditsError } from "./insufficient-credits.error.js";
import { RequestIdConflictError } from "./request-id-conflict.error.js";
import { UserNotFoundError } from "./user-not-found.error.js";

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
        status: "PENDING",
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

export function createGenerationRequestHash(input: {
  requestId?: string;
  userId: string;
  topic: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operation: "content.generate.v1",
        userId: input.userId,
        topic: input.topic,
      })
    )
    .digest("hex");
}

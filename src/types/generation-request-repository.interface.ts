import type { Content } from "@prisma/client";

export type CreateGenerationRequestResult =
  | { kind: "created"; content: Content }
  | { kind: "duplicate"; content: Content }
  | { kind: "user_not_found" }
  | { kind: "insufficient_credits" };

export interface GenerationRequestRepository {
  create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<CreateGenerationRequestResult>;
}

import type { ContentEntity } from "../domain/content.js";

export type CreateGenerationRequestResult =
  | { kind: "created"; content: ContentEntity; outboxEventId: string }
  | { kind: "duplicate"; content: ContentEntity }
  | { kind: "user_not_found" }
  | { kind: "insufficient_credits" };

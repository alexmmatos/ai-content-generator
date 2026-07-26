import type { PendingOutboxEvent } from "./pending-outbox-event.interface.js";

export interface OutboxRepository {
  findPending(limit: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  recordFailure(id: string, error: string): Promise<void>;
}

export interface PendingOutboxEvent {
  id: string;
  aggregateId: string;
  requestId: string;
}

export interface OutboxRepository {
  findPending(limit: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  recordFailure(id: string, error: string): Promise<void>;
}

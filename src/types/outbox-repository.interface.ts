export interface PendingOutboxEvent {
  id: string;
  type: string;
  aggregateId: string;
  requestId: string;
  payload: unknown;
}

export interface OutboxRepository {
  findPending(limit: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  recordFailure(id: string, error: string): Promise<void>;
}

export interface PendingOutboxPublisher {
  publishPending(limit?: number): Promise<void>;
}

export interface PendingOutboxEvent {
  id: string;
  type: string;
  aggregateId: string;
  requestId: string;
  payload: unknown;
}

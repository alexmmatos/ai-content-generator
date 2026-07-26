export interface ReconcilerLogger {
  error(message: string, context: Record<string, unknown>): void;
}

export interface ListenerLogger {
  error(message: string, context: Record<string, unknown>): void;
}

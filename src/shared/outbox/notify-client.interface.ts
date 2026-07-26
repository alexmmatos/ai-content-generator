export interface NotifyClient {
  connect(): Promise<unknown>;
  query(text: string): Promise<unknown>;
  end(): Promise<unknown>;
  on(event: "notification", listener: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "end", listener: () => void): unknown;
}

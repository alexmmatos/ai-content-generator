import { Client } from "pg";
import { OUTBOX_NOTIFY_CHANNEL } from "./outbox-channel.js";
import type { NotifyClient } from "../../types/outbox/notify-client.interface.js";
import type { ListenerLogger } from "../../types/outbox/listener-logger.interface.js";

export function createOutboxListener(input: {
  connectionString: string;
  onNotify: () => void;
  logger?: ListenerLogger;
  reconnectDelayMs?: number;
  clientFactory?: (connectionString: string) => NotifyClient;
}): {
  start(): Promise<void>;
  close(): Promise<void>;
} {
  const logger = input.logger ?? console;
  const reconnectDelayMs = input.reconnectDelayMs ?? 2000;
  const clientFactory =
    input.clientFactory ??
    ((connectionString: string) => new Client({ connectionString }));

  let closed = false;
  let client: NotifyClient | null = null;
  let reconnectHandle: ReturnType<typeof setTimeout> | null = null;

  function scheduleReconnect(): void {
    if (closed || reconnectHandle) return;
    client = null;
    reconnectHandle = setTimeout(() => {
      reconnectHandle = null;
      void connect();
    }, reconnectDelayMs);
  }

  async function connect(): Promise<void> {
    const nextClient = clientFactory(input.connectionString);
    nextClient.on("notification", input.onNotify);
    nextClient.on("error", (error: Error) => {
      logger.error("Outbox listener connection error", { error });
      scheduleReconnect();
    });
    nextClient.on("end", () => {
      scheduleReconnect();
    });

    try {
      await nextClient.connect();
      await nextClient.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
      // A close() that ran while connect()/query() were in flight already tore
      // down its own state; adopting this connection now would leak it.
      if (closed) {
        await nextClient.end();
        return;
      }
      client = nextClient;
    } catch (error) {
      logger.error("Outbox listener failed to connect", { error });
      scheduleReconnect();
    }
  }

  async function start(): Promise<void> {
    closed = false;
    await connect();
  }

  async function close(): Promise<void> {
    closed = true;
    if (reconnectHandle) {
      clearTimeout(reconnectHandle);
      reconnectHandle = null;
    }
    if (client) {
      const current = client;
      client = null;
      await current.end();
    }
  }

  return { start, close };
}

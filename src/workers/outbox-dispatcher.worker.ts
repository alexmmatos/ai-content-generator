import type { PendingOutboxPublisher } from "../types/outbox/pending-outbox-publisher.interface.js";
import type { DispatcherLogger } from "../types/outbox/dispatcher-logger.interface.js";
import type { IntervalTimer } from "../types/queue/interval-timer.interface.js";
import { systemTimer } from "../lib/queue/system-timer.js";

export function createOutboxDispatcher(input: {
  publisher: PendingOutboxPublisher;
  intervalMs?: number;
  logger?: DispatcherLogger;
  timer?: IntervalTimer;
}): {
  start(): void;
  dispatchNow(): Promise<void>;
  close(): void;
} {
  const intervalMs = input.intervalMs ?? 1000;
  const logger = input.logger ?? console;
  const timer = input.timer ?? systemTimer;
  let dispatching = false;
  let timerHandle: ReturnType<typeof setInterval> | null = null;

  async function dispatchNow(): Promise<void> {
    if (dispatching) return;
    dispatching = true;
    try {
      await input.publisher.publishPending();
    } catch (error) {
      logger.error("Outbox dispatcher failed", error);
    } finally {
      dispatching = false;
    }
  }

  function start(): void {
    if (timerHandle) return;
    void dispatchNow();
    timerHandle = timer.set(() => void dispatchNow(), intervalMs);
  }

  function close(): void {
    if (!timerHandle) return;
    timer.clear(timerHandle);
    timerHandle = null;
  }

  return { start, dispatchNow, close };
}

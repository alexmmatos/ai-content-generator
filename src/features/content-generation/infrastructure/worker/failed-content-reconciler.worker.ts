import type { ContentStatusService } from "../../application/content-status.service.js";
import type { FailedJobSource } from "./failed-job-source.interface.js";
import type { ReconcilerLogger } from "./reconciler-logger.interface.js";
import type { IntervalTimer } from "../../../../shared/scheduling/interval-timer.interface.js";
import { systemTimer } from "../../../../shared/scheduling/system-timer.js";
import { shouldMarkFailed } from "./should-mark-failed.js";

export function createFailedContentReconciler(input: {
  queue: FailedJobSource;
  statusService: ContentStatusService;
  intervalMs?: number;
  batchSize?: number;
  logger?: ReconcilerLogger;
  timer?: IntervalTimer;
}): {
  start(): void;
  reconcileNow(): Promise<void>;
  close(): Promise<void>;
} {
  const intervalMs = input.intervalMs ?? 5000;
  const batchSize = input.batchSize ?? 100;
  const logger = input.logger ?? console;
  const timer = input.timer ?? systemTimer;
  let active: Promise<void> | null = null;
  let timerHandle: ReturnType<typeof setInterval> | null = null;

  async function run(): Promise<void> {
    let start = 0;
    let hasMore = true;
    while (hasMore) {
      const jobs = await input.queue.getJobs(
        ["failed"],
        start,
        start + batchSize - 1,
        true
      );
      for (const job of jobs) {
        if (
          job.name !== "generate-content" ||
          job.data.terminalStatusPersisted ||
          !shouldMarkFailed(job)
        ) {
          continue;
        }

        try {
          const result = await input.statusService.finalizeFailure(job.data.contentId);
          if (result !== "retry_required") {
            await job.updateData({ ...job.data, terminalStatusPersisted: true });
          }
        } catch (error) {
          logger.error("Failed content reconciliation failed", {
            contentId: job.data.contentId,
            requestId: job.data.requestId,
            jobId: job.id,
            error,
          });
        }
      }
      hasMore = jobs.length === batchSize;
      start += batchSize;
    }
  }

  function reconcileNow(): Promise<void> {
    if (active) return active;
    active = run()
      .catch((error: unknown) => {
        logger.error("Failed content reconciliation scan failed", { error });
      })
      .finally(() => {
        active = null;
      });
    return active;
  }

  function start(): void {
    if (timerHandle) return;
    void reconcileNow();
    timerHandle = timer.set(() => void reconcileNow(), intervalMs);
  }

  async function close(): Promise<void> {
    if (timerHandle) {
      timer.clear(timerHandle);
      timerHandle = null;
    }
    if (active) await active;
  }

  return { start, reconcileNow, close };
}

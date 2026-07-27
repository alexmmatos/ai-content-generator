import { z } from "zod";
import type { ContentJobQueue } from "../../application/ports/content-job-queue.interface.js";
import type { OutboxRepository } from "../../../../shared/outbox/outbox-repository.interface.js";
import type { PendingOutboxPublisher } from "../../../../shared/outbox/pending-outbox-publisher.interface.js";
import { LIMITS } from "../../../../shared/config/limits.js";

const GenerationPayloadSchema = z.object({
  contentId: z.string().min(1),
  requestId: z.string().min(1),
});

const CancellationPayloadSchema = GenerationPayloadSchema;

export class OutboxPublicationService implements PendingOutboxPublisher {
  constructor(
    private outbox: OutboxRepository,
    private queue: ContentJobQueue
  ) {}

  async publishPending(limit: number = LIMITS.outboxPublishing.batchSize): Promise<void> {
    const events = await this.outbox.findPending(limit);
    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  private async publishEvent(event: {
    id: string;
    type: string;
    aggregateId: string;
    requestId: string;
    payload: unknown;
  }): Promise<void> {
    try {
      if (event.type === "CONTENT_GENERATION_REQUESTED") {
        const data = GenerationPayloadSchema.parse(event.payload);
        await this.queue.add("generate-content", data, {
          jobId: event.requestId,
        });
      } else if (event.type === "CONTENT_CANCELLATION_REQUESTED") {
        const data = CancellationPayloadSchema.parse(event.payload);
        await this.queue.add("cleanup-content", data, {
          jobId: `cancel-${event.aggregateId}`,
          attempts: LIMITS.outboxCleanupJob.attempts,
          backoff: { type: "exponential", delay: LIMITS.outboxCleanupJob.backoffDelayMs },
          removeOnComplete: {
            age: LIMITS.outboxCleanupJob.completedRetention.ageSeconds,
            count: LIMITS.outboxCleanupJob.completedRetention.count,
          },
          removeOnFail: false,
        });
      } else {
        throw new Error(`Unsupported outbox event type: ${event.type}`);
      }

      await this.outbox.markPublished(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outbox error";
      try {
        await this.outbox.recordFailure(event.id, message);
      } catch {
        // The event remains pending even when diagnostics cannot be persisted.
      }
    }
  }
}

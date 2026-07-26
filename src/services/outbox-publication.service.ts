import { z } from "zod";
import type { ContentJobQueue } from "../types/content-job-queue.interface.js";
import type { OutboxRepository } from "../types/outbox-repository.interface.js";
import type { PendingOutboxPublisher } from "../types/pending-outbox-publisher.interface.js";

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

  async publishPending(limit = 50): Promise<void> {
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
          attempts: 10,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
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

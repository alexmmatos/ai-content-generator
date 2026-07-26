import type { Queue } from "bullmq";
import type { OutboxRepository } from "../types/outbox-repository.interface.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.interface.js";

export async function publishPendingOutboxEvents(
  outbox: OutboxRepository,
  queue: Pick<Queue<GenerateContentJobData>, "add">,
  limit = 50
): Promise<void> {
  const events = await outbox.findPending(limit);

  for (const event of events) {
    try {
      await queue.add(
        "generate-content",
        {
          contentId: event.aggregateId,
          requestId: event.requestId,
        },
        { jobId: event.requestId }
      );
      await outbox.markPublished(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outbox error";
      await outbox.recordFailure(event.id, message);
    }
  }
}

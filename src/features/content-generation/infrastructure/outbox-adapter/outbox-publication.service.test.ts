import { describe, expect, it, vi } from "vitest";
import type { OutboxRepository } from "../../../../shared/outbox/outbox-repository.interface.js";
import type { PendingOutboxEvent } from "../../../../shared/outbox/pending-outbox-event.interface.js";
import { OutboxPublicationService } from "./outbox-publication.service.js";

const GENERATION_EVENT: PendingOutboxEvent = {
  id: "event-1",
  type: "CONTENT_GENERATION_REQUESTED",
  aggregateId: "content-1",
  requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  payload: {
    contentId: "content-1",
    requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  },
};

function makeOutbox(events: PendingOutboxEvent[] = []): OutboxRepository {
  return {
    findPending: vi.fn().mockResolvedValue(events),
    markPublished: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
  };
}

describe("OutboxPublicationService", () => {
  it("publishes generation events with request-id as jobId", async () => {
    const outbox = makeOutbox([GENERATION_EVENT]);
    const queue = { add: vi.fn().mockResolvedValue({}) };

    await new OutboxPublicationService(outbox, queue).publishPending();

    expect(queue.add).toHaveBeenCalledWith(
      "generate-content",
      GENERATION_EVENT.payload,
      { jobId: GENERATION_EVENT.requestId }
    );
    expect(outbox.markPublished).toHaveBeenCalledWith(GENERATION_EVENT.id);
  });

  it("publishes cancellation cleanup with independent retry options", async () => {
    const event: PendingOutboxEvent = {
      ...GENERATION_EVENT,
      id: "event-2",
      type: "CONTENT_CANCELLATION_REQUESTED",
    };
    const outbox = makeOutbox([event]);
    const queue = { add: vi.fn().mockResolvedValue({}) };

    await new OutboxPublicationService(outbox, queue).publishPending(10);

    expect(outbox.findPending).toHaveBeenCalledWith(10);
    expect(queue.add).toHaveBeenCalledWith(
      "cleanup-content",
      event.payload,
      expect.objectContaining({
        jobId: "cancel-content-1",
        attempts: 10,
        backoff: { type: "exponential", delay: 2000 },
      })
    );
  });

  it.each([
    ["queue failure", [GENERATION_EVENT], new Error("Redis unavailable")],
    [
      "invalid payload",
      [{ ...GENERATION_EVENT, payload: {} }],
      undefined,
    ],
    [
      "unsupported event",
      [{ ...GENERATION_EVENT, type: "UNKNOWN" }],
      undefined,
    ],
  ])("records %s and leaves the event pending", async (_name, events, queueError) => {
    const outbox = makeOutbox(events as PendingOutboxEvent[]);
    const queue = {
      add: queueError
        ? vi.fn().mockRejectedValue(queueError)
        : vi.fn().mockResolvedValue({}),
    };

    await new OutboxPublicationService(outbox, queue).publishPending();

    expect(outbox.markPublished).not.toHaveBeenCalled();
    expect(outbox.recordFailure).toHaveBeenCalledWith(
      GENERATION_EVENT.id,
      expect.any(String)
    );
  });

  it("preserves the original result when diagnostics persistence fails", async () => {
    const outbox = makeOutbox([GENERATION_EVENT]);
    vi.mocked(outbox.recordFailure).mockRejectedValueOnce(new Error("database unavailable"));
    const queue = { add: vi.fn().mockRejectedValue("failure") };

    await expect(
      new OutboxPublicationService(outbox, queue).publishPending()
    ).resolves.toBeUndefined();
    expect(outbox.markPublished).not.toHaveBeenCalled();
  });
});

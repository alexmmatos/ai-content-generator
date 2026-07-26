import { describe, expect, it, vi } from "vitest";
import { publishPendingOutboxEvents } from "./publish-pending-outbox-events.js";
import type {
  OutboxRepository,
  PendingOutboxEvent,
} from "../types/outbox-repository.interface.js";

class FakeOutboxRepository implements OutboxRepository {
  events: PendingOutboxEvent[] = [];
  published: string[] = [];
  failures: Array<{ id: string; error: string }> = [];

  async findPending(): Promise<PendingOutboxEvent[]> {
    return this.events;
  }

  async markPublished(id: string): Promise<void> {
    this.published.push(id);
  }

  async recordFailure(id: string, error: string): Promise<void> {
    this.failures.push({ id, error });
  }
}

const EVENT: PendingOutboxEvent = {
  id: "event-1",
  aggregateId: "content-1",
  requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

describe("publishPendingOutboxEvents", () => {
  it("publishes with request-id as jobId and marks the event", async () => {
    const outbox = new FakeOutboxRepository();
    outbox.events.push(EVENT);
    const queue = { add: vi.fn().mockResolvedValue({}) };

    await publishPendingOutboxEvents(outbox, queue);

    expect(queue.add).toHaveBeenCalledWith(
      "generate-content",
      {
        contentId: "content-1",
        requestId: EVENT.requestId,
      },
      { jobId: EVENT.requestId }
    );
    expect(outbox.published).toEqual(["event-1"]);
    expect(outbox.failures).toEqual([]);
  });

  it("records queue failures and leaves the event unpublished", async () => {
    const outbox = new FakeOutboxRepository();
    outbox.events.push(EVENT);
    const queue = { add: vi.fn().mockRejectedValue(new Error("Redis unavailable")) };

    await publishPendingOutboxEvents(outbox, queue);

    expect(outbox.published).toEqual([]);
    expect(outbox.failures).toEqual([
      { id: "event-1", error: "Redis unavailable" },
    ]);
  });

  it("handles non-Error rejection values", async () => {
    const outbox = new FakeOutboxRepository();
    outbox.events.push(EVENT);
    const queue = { add: vi.fn().mockRejectedValue("failure") };

    await publishPendingOutboxEvents(outbox, queue);

    expect(outbox.failures).toEqual([
      { id: "event-1", error: "Unknown outbox error" },
    ]);
  });

  it("does nothing when no event is pending", async () => {
    const outbox = new FakeOutboxRepository();
    const queue = { add: vi.fn() };

    await publishPendingOutboxEvents(outbox, queue, 10);

    expect(queue.add).not.toHaveBeenCalled();
  });
});

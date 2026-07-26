import { describe, expect, it, vi } from "vitest";

const queueConstructor = vi.hoisted(() => vi.fn());

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(...args: unknown[]) {
      queueConstructor(...args);
    }
  },
}));

import { CONTENT_JOB_OPTIONS, createContentQueue } from "./content-queue.js";
import { CONTENT_QUEUE_NAME } from "./queue-name.js";

describe("content queue configuration", () => {
  it("creates a queue with deterministic retry and retention options", () => {
    const connection = {};

    createContentQueue(connection);

    expect(CONTENT_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: false,
    });
    expect(queueConstructor).toHaveBeenCalledWith(CONTENT_QUEUE_NAME, {
      connection,
      defaultJobOptions: CONTENT_JOB_OPTIONS,
    });
  });

  it("supports an isolated queue name for integration tests", () => {
    createContentQueue({}, "isolated-content-queue");

    expect(queueConstructor).toHaveBeenCalledWith(
      "isolated-content-queue",
      expect.any(Object)
    );
  });
});

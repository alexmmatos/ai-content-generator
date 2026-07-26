import { describe, expect, it, vi } from "vitest";
import { createRedisWorkerConnection } from "./create-redis-worker-connection.js";

const redisConstructor = vi.hoisted(() => vi.fn());

vi.mock("ioredis", () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      redisConstructor(...args);
    }
  },
}));

describe("createRedisWorkerConnection", () => {
  it("creates a BullMQ-compatible worker connection", () => {
    createRedisWorkerConnection("redis://localhost:6379");

    expect(redisConstructor).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  });
});

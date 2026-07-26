import { describe, expect, it, vi } from "vitest";

const redisConstructor = vi.hoisted(() => vi.fn());

vi.mock("ioredis", () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      redisConstructor(...args);
    }
  },
}));

import {
  createRedisProducerConnection,
  createRedisWorkerConnection,
} from "./redis.js";

describe("Redis connection factories", () => {
  it("creates a fail-fast producer connection", () => {
    createRedisProducerConnection("redis://localhost:6379");

    expect(redisConstructor).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  });

  it("creates a BullMQ-compatible worker connection", () => {
    createRedisWorkerConnection("redis://localhost:6379");

    expect(redisConstructor).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  });
});

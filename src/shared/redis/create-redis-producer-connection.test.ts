import { describe, expect, it, vi } from "vitest";
import { createRedisProducerConnection } from "./create-redis-producer-connection.js";

const redisConstructor = vi.hoisted(() => vi.fn());

vi.mock("ioredis", () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      redisConstructor(...args);
    }
  },
}));

describe("createRedisProducerConnection", () => {
  it("creates a fail-fast producer connection", () => {
    createRedisProducerConnection("redis://localhost:6379");

    expect(redisConstructor).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  });
});

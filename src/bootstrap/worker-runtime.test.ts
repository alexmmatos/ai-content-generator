import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../shared/env/worker-env.type.js";
import { createOutboxListener } from "../shared/outbox/outbox-listener.js";
import { createWorkerRuntime } from "./worker-runtime.js";

const mocks = vi.hoisted(() => ({
  producerRedis: { quit: vi.fn().mockResolvedValue(undefined) },
  workerRedis: { quit: vi.fn().mockResolvedValue(undefined) },
  queue: { close: vi.fn().mockResolvedValue(undefined), add: vi.fn(), getJobs: vi.fn() },
  worker: { close: vi.fn().mockResolvedValue(undefined), on: vi.fn() },
  dispatcher: { start: vi.fn(), close: vi.fn(), dispatchNow: vi.fn() },
  reconciler: {
    start: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    reconcileNow: vi.fn(),
  },
  outboxListener: {
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
  disconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../shared/redis/create-redis-producer-connection.js", () => ({
  createRedisProducerConnection: vi.fn(() => mocks.producerRedis),
}));
vi.mock("../shared/redis/create-redis-worker-connection.js", () => ({
  createRedisWorkerConnection: vi.fn(() => mocks.workerRedis),
}));
vi.mock("../features/content-generation/infrastructure/queue/content-queue.js", () => ({
  createContentQueue: vi.fn(() => mocks.queue),
}));
vi.mock("../features/content-generation/infrastructure/storage/s3.js", () => ({
  createS3Client: vi.fn(() => ({})),
}));
vi.mock("../shared/db/prisma.js", () => ({
  prisma: { $disconnect: mocks.disconnect },
}));
vi.mock("../features/content-generation/infrastructure/storage/upload-content-file.js", () => ({
  S3ContentStorage: class {},
}));
vi.mock("../features/content-generation/infrastructure/persistence/content.repository.js", () => ({
  PrismaContentRepository: class {},
}));
vi.mock("../shared/outbox/outbox.repository.js", () => ({
  PrismaOutboxRepository: class {},
}));
vi.mock("../features/content-generation/infrastructure/worker/content-generation.worker.js", () => ({
  createContentGenerationWorker: vi.fn(() => mocks.worker),
}));
vi.mock("../shared/outbox/outbox-dispatcher.worker.js", () => ({
  createOutboxDispatcher: vi.fn(() => mocks.dispatcher),
}));
vi.mock("../features/content-generation/infrastructure/worker/failed-content-reconciler.worker.js", () => ({
  createFailedContentReconciler: vi.fn(() => mocks.reconciler),
}));
vi.mock("../shared/outbox/outbox-listener.js", () => ({
  createOutboxListener: vi.fn(() => mocks.outboxListener),
}));

const CONFIG = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/database",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "content",
  S3_PUBLIC_URL: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "access",
  S3_SECRET_ACCESS_KEY: "secret",
  OUTBOX_POLL_INTERVAL_MS: 250,
  FAILED_RECONCILIATION_INTERVAL_MS: 500,
  SIMULATED_AI_FAILURE_RATE: 0.2,
} satisfies WorkerEnv;

describe("createWorkerRuntime", () => {
  it("starts background loops and closes independent worker resources", async () => {
    const runtime = createWorkerRuntime(CONFIG);

    runtime.start();
    expect(mocks.dispatcher.start).toHaveBeenCalledOnce();
    expect(mocks.reconciler.start).toHaveBeenCalledOnce();
    expect(mocks.outboxListener.start).toHaveBeenCalledOnce();

    await runtime.close();
    expect(mocks.outboxListener.close).toHaveBeenCalledOnce();
    expect(mocks.dispatcher.close).toHaveBeenCalledOnce();
    expect(mocks.reconciler.close).toHaveBeenCalledOnce();
    expect(mocks.worker.close).toHaveBeenCalledOnce();
    expect(mocks.queue.close).toHaveBeenCalledOnce();
    expect(mocks.producerRedis.quit).toHaveBeenCalledOnce();
    expect(mocks.workerRedis.quit).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it("wakes the outbox dispatcher immediately when the listener observes a notification", () => {
    createWorkerRuntime(CONFIG);

    const onNotify = vi.mocked(createOutboxListener).mock.calls.at(-1)?.[0].onNotify;
    if (!onNotify) throw new Error("outbox listener was not created with onNotify");
    onNotify();

    expect(mocks.dispatcher.dispatchNow).toHaveBeenCalledOnce();
  });
});

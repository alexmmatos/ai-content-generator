import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { QueueEvents } from "bullmq";
import { prisma } from "../../../../shared/db/prisma.js";
import { createContentQueue } from "../queue/content-queue.js";
import { parseWorkerEnv } from "../../../../shared/env/parse-worker-env.js";
import { createRedisWorkerConnection } from "../../../../shared/redis/create-redis-worker-connection.js";
import { PrismaContentRepository } from "../persistence/content.repository.js";
import { ContentStatusService } from "../../application/content-status.service.js";
import type { ContentStorage } from "../../application/ports/content-storage.interface.js";
import { createContentGenerationWorker } from "./content-generation.worker.js";
import { createFailedContentReconciler } from "./failed-content-reconciler.worker.js";

const env = parseWorkerEnv(process.env);

const storage: ContentStorage = {
  keyFor: (contentId) => `content/${contentId}.txt`,
  upload: async ({ contentId }) => ({
    key: `content/${contentId}.txt`,
    url: `http://storage/content/${contentId}.txt`,
  }),
  delete: async () => undefined,
};

async function waitForStatus(
  contentId: string,
  expected: "FAILED" | "CANCELED",
  timeoutMs = 5000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await prisma.content.findUnique({ where: { id: contentId } });
    if (content?.status === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`content ${contentId} did not reach ${expected}`);
}

async function withRealQueue(
  simulateAiCall: (topic: string) => Promise<string>,
  run: (input: {
    contentId: string;
    statusService: ContentStatusService;
    queue: ReturnType<typeof createContentQueue>;
    events: QueueEvents;
  }) => Promise<void>
): Promise<void> {
  const queueName = `content-generation-integration-${randomUUID()}`;
  const redis = createRedisWorkerConnection(env.REDIS_URL);
  const eventRedis = redis.duplicate();
  const queue = createContentQueue(redis, queueName);
  const events = new QueueEvents(queueName, { connection: eventRedis });
  const statusService = new ContentStatusService(new PrismaContentRepository());
  const worker = createContentGenerationWorker({
    queueName,
    connection: redis,
    statusService,
    contentStorage: storage,
    simulateAiCall,
    logger: { info: () => undefined, error: () => undefined },
  });
  const user = await prisma.user.create({ data: { credits: 1 } });
  const content = await prisma.content.create({
    data: {
      requestId: randomUUID(),
      requestHash: randomUUID(),
      userId: user.id,
      topic: "integração BullMQ",
    },
  });

  try {
    await events.waitUntilReady();
    await run({ contentId: content.id, statusService, queue, events });
  } finally {
    await worker.close();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await eventRedis.quit();
    await redis.quit();
    await prisma.content.deleteMany({ where: { id: content.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
}

describe.sequential("content worker with real Redis/BullMQ", () => {
  it("retries twice with exponential backoff and completes on the third attempt", async () => {
    let attempts = 0;
    const startedAt = Date.now();

    await withRealQueue(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("transient AI failure");
        return "texto gerado";
      },
      async ({ contentId, queue, events }) => {
        const job = await queue.add("generate-content", {
          contentId,
          requestId: randomUUID(),
        });

        await job.waitUntilFinished(events, 15_000);

        expect(attempts).toBe(3);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(5_500);
        expect(
          (await prisma.content.findUniqueOrThrow({ where: { id: contentId } })).status
        ).toBe("COMPLETED");
      }
    );
  });

  it("persists FAILED after all real BullMQ attempts are exhausted", async () => {
    let attempts = 0;

    await withRealQueue(
      async () => {
        attempts += 1;
        throw new Error("permanent AI failure");
      },
      async ({ contentId, queue, events }) => {
        const job = await queue.add("generate-content", {
          contentId,
          requestId: randomUUID(),
        });

        await expect(job.waitUntilFinished(events, 15_000)).rejects.toThrow(
          "permanent AI failure"
        );
        await waitForStatus(contentId, "FAILED");
        expect(attempts).toBe(3);
      }
    );
  });

  it("does not resurrect content canceled before a retry", async () => {
    let attempts = 0;
    let statusService: ContentStatusService | undefined;
    let contentId: string | undefined;

    await withRealQueue(
      async () => {
        attempts += 1;
        if (!statusService || !contentId) throw new Error("test context unavailable");
        await statusService.cancel(contentId);
        throw new Error("retry after cancel");
      },
      async (context) => {
        statusService = context.statusService;
        contentId = context.contentId;
        const job = await context.queue.add("generate-content", {
          contentId,
          requestId: randomUUID(),
        });

        await job.waitUntilFinished(context.events, 10_000);
        await waitForStatus(contentId, "CANCELED");
        expect(attempts).toBe(1);
      }
    );
  });

  it("reconciles FAILED after the listener cannot persist it", async () => {
    await withRealQueue(
      async () => {
        throw new Error("permanent AI failure");
      },
      async ({ contentId, statusService, queue, events }) => {
        const original = statusService.finalizeFailure.bind(statusService);
        const finalize = vi
          .spyOn(statusService, "finalizeFailure")
          .mockRejectedValueOnce(new Error("database unavailable"))
          .mockImplementation(original);
        const job = await queue.add("generate-content", {
          contentId,
          requestId: randomUUID(),
        });

        await expect(job.waitUntilFinished(events, 15_000)).rejects.toThrow(
          "permanent AI failure"
        );
        const deadline = Date.now() + 2000;
        while (finalize.mock.calls.length === 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(finalize).toHaveBeenCalledOnce();
        expect(
          (await prisma.content.findUniqueOrThrow({ where: { id: contentId } })).status
        ).toBe("PROCESSING");

        const reconciler = createFailedContentReconciler({
          queue,
          statusService,
          logger: { error: () => undefined },
        });
        await reconciler.reconcileNow();

        await waitForStatus(contentId, "FAILED");
        expect((await job.getState())).toBe("failed");
        const persistedJob = await queue.getJob(job.id ?? "");
        expect(persistedJob?.data.terminalStatusPersisted).toBe(true);
      }
    );
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

import { createContentQueue } from "../lib/content-queue.js";
import type { WorkerEnv } from "../types/worker-env.type.js";
import { createOutboxListener } from "../lib/outbox-listener.js";
import { prisma } from "../lib/prisma.js";
import { createRedisProducerConnection } from "../lib/create-redis-producer-connection.js";
import { createRedisWorkerConnection } from "../lib/create-redis-worker-connection.js";
import { createS3Client } from "../lib/s3.js";
import { S3ContentStorage } from "../lib/upload-content-file.js";
import { PrismaContentRepository } from "../repositories/content.repository.js";
import { PrismaOutboxRepository } from "../repositories/outbox.repository.js";
import { ContentStatusService } from "../services/content-status.service.js";
import { OutboxPublicationService } from "../services/outbox-publication.service.js";
import { createContentGenerationWorker } from "../workers/content-generation.worker.js";
import { createFailedContentReconciler } from "../workers/failed-content-reconciler.worker.js";
import { createOutboxDispatcher } from "../workers/outbox-dispatcher.worker.js";
import { createAiSimulator } from "../workers/simulate-ai-call.js";

export function createWorkerRuntime(config: WorkerEnv): {
  start(): void;
  close(): Promise<void>;
} {
  const workerRedis = createRedisWorkerConnection(config.REDIS_URL);
  const producerRedis = createRedisProducerConnection(config.REDIS_URL);
  const queue = createContentQueue(producerRedis);
  const storage = new S3ContentStorage(
    createS3Client(config),
    config.S3_BUCKET,
    config.S3_PUBLIC_URL
  );
  const statusService = new ContentStatusService(new PrismaContentRepository());
  const worker = createContentGenerationWorker({
    connection: workerRedis,
    statusService,
    contentStorage: storage,
    simulateAiCall: createAiSimulator({
      failureRate: config.SIMULATED_AI_FAILURE_RATE,
    }),
  });
  const dispatcher = createOutboxDispatcher({
    publisher: new OutboxPublicationService(new PrismaOutboxRepository(), queue),
    intervalMs: config.OUTBOX_POLL_INTERVAL_MS,
  });
  const reconciler = createFailedContentReconciler({
    queue,
    statusService,
    intervalMs: config.FAILED_RECONCILIATION_INTERVAL_MS,
  });
  const outboxListener = createOutboxListener({
    connectionString: config.DATABASE_URL,
    onNotify: () => void dispatcher.dispatchNow(),
  });

  return {
    start() {
      dispatcher.start();
      reconciler.start();
      void outboxListener.start();
    },
    async close() {
      await outboxListener.close();
      dispatcher.close();
      await reconciler.close();
      await worker.close();
      await queue.close();
      await producerRedis.quit();
      await workerRedis.quit();
      await prisma.$disconnect();
    },
  };
}

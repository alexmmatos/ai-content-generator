import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { afterAll, describe, expect, it } from "vitest";
import { parseWorkerEnv } from "../src/shared/env/parse-worker-env.js";
import { prisma } from "../src/shared/db/prisma.js";
import { createS3Client } from "../src/features/content-generation/infrastructure/storage/s3.js";

const phase = process.env.E2E_INDEPENDENCE_PHASE;
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3100";
const userId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const requestId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const topic = "independência entre API e worker";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("API and worker runtime independence", () => {
  it.runIf(phase === "accept")(
    "accepts and persists a request while worker, Redis and Minio are stopped",
    async () => {
      await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, credits: 1 },
        update: { credits: 1 },
      });

      const response = await fetch(`${apiUrl}/api/content/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "request-id": requestId,
        },
        body: JSON.stringify({ userId, topic }),
      });

      expect(response.status).toBe(201);
      const content = await prisma.content.findUniqueOrThrow({ where: { requestId } });
      expect(content.status).toBe("PENDING");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
        0
      );
      expect(
        (
          await prisma.outboxEvent.findFirstOrThrow({
            where: { requestId, type: "CONTENT_GENERATION_REQUESTED" },
          })
        ).publishedAt
      ).toBeNull();
    }
  );

  it.runIf(phase === "process")(
    "processes the persisted request while the API is stopped",
    async () => {
      const env = parseWorkerEnv(process.env);
      const s3 = createS3Client(env);
      try {
        const deadline = Date.now() + 20_000;
        let content = await prisma.content.findUniqueOrThrow({ where: { requestId } });
        while (content.status !== "COMPLETED" && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          content = await prisma.content.findUniqueOrThrow({ where: { requestId } });
        }

        expect(content.status).toBe("COMPLETED");
        await expect(
          s3.send(
            new HeadObjectCommand({
              Bucket: env.S3_BUCKET,
              Key: `content/${content.id}.txt`,
            })
          )
        ).resolves.toBeDefined();

        await s3.send(
          new DeleteObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: `content/${content.id}.txt`,
          })
        );
        await prisma.outboxEvent.deleteMany({ where: { requestId } });
        await prisma.content.deleteMany({ where: { requestId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      } finally {
        s3.destroy();
      }
    }
  );
});

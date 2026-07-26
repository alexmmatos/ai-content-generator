import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentQueue } from "../src/features/content-generation/infrastructure/queue/content-queue.js";
import { parseWorkerEnv } from "../src/shared/env/parse-worker-env.js";
import { prisma } from "../src/shared/db/prisma.js";
import { createRedisProducerConnection } from "../src/shared/redis/create-redis-producer-connection.js";
import { createS3Client } from "../src/features/content-generation/infrastructure/storage/s3.js";

const env = parseWorkerEnv(process.env);

interface GenerateResponse {
  requestId: string;
  contentId: string;
  status: string;
}

interface ContentResponse {
  id: string;
  status: string;
  resultUrl: string | null;
}

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3100";
const s3 = createS3Client(env);
const createdRequestIds: string[] = [];
const createdContentIds: string[] = [];
let userId = "";

async function generate(requestId: string, topic: string): Promise<Response> {
  return fetch(`${apiUrl}/api/content/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "request-id": requestId,
    },
    body: JSON.stringify({ userId, topic }),
  });
}

async function getContent(contentId: string): Promise<ContentResponse> {
  const response = await fetch(`${apiUrl}/api/content/${contentId}`);
  if (!response.ok) throw new Error(`GET content failed with ${response.status}`);
  return response.json() as Promise<ContentResponse>;
}

async function waitFor(
  contentId: string,
  predicate: (content: ContentResponse) => boolean,
  timeoutMs = 25_000
): Promise<ContentResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await getContent(contentId);
    if (predicate(content)) return content;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`content ${contentId} did not reach the expected state`);
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { credits: 5 } });
  userId = user.id;
});

afterAll(async () => {
  const redis = createRedisProducerConnection(env.REDIS_URL);
  const queue = createContentQueue(redis);
  try {
    for (const requestId of createdRequestIds) {
      const job = await queue.getJob(requestId);
      if (job) await job.remove();
    }
    for (const contentId of createdContentIds) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `content/${contentId}.txt`,
        })
      );
    }
    await prisma.outboxEvent.deleteMany({
      where: { requestId: { in: createdRequestIds } },
    });
    await prisma.content.deleteMany({
      where: { id: { in: createdContentIds } },
    });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  } finally {
    await queue.close();
    await redis.quit();
    await prisma.$disconnect();
    s3.destroy();
  }
});

describe.sequential("full HTTP -> outbox -> BullMQ -> Minio flow", () => {
  it("generates content through the outbox and replays the current status", async () => {
    const topic = "teste ponta a ponta";
    const requestId = randomUUID();
    createdRequestIds.push(requestId);
    const response = await generate(requestId, topic);
    const body = (await response.json()) as GenerateResponse;
    createdContentIds.push(body.contentId);

    expect(response.status).toBe(201);
    expect(body.requestId).toBe(requestId);
    const completed = await waitFor(
      body.contentId,
      (content) => content.status === "COMPLETED"
    );
    expect(completed.status).toBe("COMPLETED");
    if (!completed.resultUrl) throw new Error("generation did not produce a result URL");

    const download = await fetch(completed.resultUrl);
    expect(download.status).toBe(200);
    expect(await download.text()).toContain(topic);
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: `content/${completed.id}.txt`,
      })
    );
    expect(head.Metadata?.["request-id"]).toBe(requestId);

    const replay = await generate(requestId, topic);
    expect(replay.headers.get("request-replayed")).toBe("true");
    expect((await replay.json()) as GenerateResponse).toMatchObject({
      contentId: completed.id,
      status: "COMPLETED",
    });
  });

  it("cancels in flight without resurrection or an orphan object", async () => {
    const requestId = randomUUID();
    createdRequestIds.push(requestId);
    const generated = await generate(requestId, "cancelamento ponta a ponta");
    const body = (await generated.json()) as GenerateResponse;
    createdContentIds.push(body.contentId);
    await waitFor(body.contentId, (content) => content.status === "PROCESSING");

    const canceled = await fetch(`${apiUrl}/api/content/${body.contentId}/cancel`, {
      method: "POST",
    });
    expect(await canceled.json()).toMatchObject({
      status: "CANCELED",
      canceled: true,
    });
    const repeated = await fetch(`${apiUrl}/api/content/${body.contentId}/cancel`, {
      method: "POST",
    });
    expect(await repeated.json()).toMatchObject({
      status: "CANCELED",
      canceled: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 8_000));
    expect((await getContent(body.contentId)).status).toBe("CANCELED");
    await expect(
      s3.send(
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `content/${body.contentId}.txt`,
        })
      )
    ).rejects.toThrow();
  });
});

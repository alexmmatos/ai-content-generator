import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../app.js";
import { ContentGenerationService } from "../services/content-generation.service.js";
import { ContentStatusService } from "../services/content-status.service.js";
import { FakeUserRepository } from "../test-utils/fake-user-repository.js";
import { FakeContentRepository } from "../test-utils/fake-content-repository.js";
import { FakeGenerationRequestRepository } from "../test-utils/fake-generation-request-repository.js";
import { makeUser } from "../test-utils/make-user.js";
import { makeContent } from "../test-utils/make-content.js";

function buildTestApp() {
  const users = new FakeUserRepository();
  const contents = new FakeContentRepository();
  const requests = new FakeGenerationRequestRepository(users, contents);

  const app = buildApp({
    contentGenerationService: new ContentGenerationService(requests),
    contentStatusService: new ContentStatusService(contents),
  });

  return { app, users, contents, requests };
}

const USER_ID = "11111111-1111-1111-1111-111111111111";
const CONTENT_ID = "22222222-2222-2222-2222-222222222222";

describe("POST /api/content/generate", () => {
  it("uses a supplied request-id and returns it with the PENDING content", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 1 }));
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      headers: { "request-id": requestId },
      payload: { topic: "gatos", userId: USER_ID },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["request-id"]).toBe(requestId);
    expect(response.json()).toMatchObject({ requestId, status: "PENDING" });
    expect(response.json().contentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("generates and returns a request-id when the header is absent", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 1 }));

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload: { topic: "gatos", userId: USER_ID },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().requestId).toBe(response.headers["request-id"]);
    expect(response.json().requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("returns 400 for an invalid request-id header", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 1 }));

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      headers: { "request-id": "invalid" },
      payload: { topic: "gatos", userId: USER_ID },
    });

    expect(response.statusCode).toBe(400);
    expect((await users.findById(USER_ID))?.credits).toBe(1);
  });

  it("replays the same request-id without debiting again", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 2 }));
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const request = {
      method: "POST" as const,
      url: "/api/content/generate",
      headers: { "request-id": requestId },
      payload: { topic: "gatos", userId: USER_ID },
    };

    const first = await app.inject(request);
    const replay = await app.inject(request);

    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());
    expect(replay.headers["request-replayed"]).toBe("true");
    expect((await users.findById(USER_ID))?.credits).toBe(1);
  });

  it("returns 409 when a request-id is reused with another payload", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 2 }));
    const headers = {
      "request-id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };

    await app.inject({
      method: "POST",
      url: "/api/content/generate",
      headers,
      payload: { topic: "gatos", userId: USER_ID },
    });
    const conflict = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      headers,
      payload: { topic: "cachorros", userId: USER_ID },
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      error: "Request ID already used with a different payload",
    });
  });

  it.each([
    [{ topic: "", userId: USER_ID }, "empty topic"],
    [{ topic: "gatos", userId: "not-a-uuid" }, "invalid user id"],
    [{ userId: USER_ID }, "missing topic"],
  ])("returns 400 for %s (%s)", async (payload, _caseName) => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Validation error" });
  });

  it("accepts a topic exactly at the 500 character limit", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 1 }));

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload: { topic: "a".repeat(500), userId: USER_ID },
    });

    expect(response.statusCode).toBe(201);
  });

  it("rejects a topic over the 500 character limit without debiting credit", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 1 }));

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload: { topic: "a".repeat(501), userId: USER_ID },
    });

    expect(response.statusCode).toBe(400);
    expect((await users.findById(USER_ID))?.credits).toBe(1);
  });

  it("returns 402 when the user has no credits", async () => {
    const { app, users } = buildTestApp();
    users.seed(makeUser({ id: USER_ID, credits: 0 }));

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload: { topic: "gatos", userId: USER_ID },
    });

    expect(response.statusCode).toBe(402);
    expect(response.json()).toEqual({ error: "Insufficient credits" });
  });

  it("returns 404 when the user doesn't exist", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload: { topic: "gatos", userId: "33333333-3333-3333-3333-333333333333" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "User not found" });
  });

  it("returns 500 when an unexpected dependency error occurs", async () => {
    const { app, requests } = buildTestApp();
    vi.spyOn(requests, "create").mockRejectedValueOnce(new Error("database unavailable"));

    const response = await app.inject({
      method: "POST",
      url: "/api/content/generate",
      payload: { topic: "gatos", userId: USER_ID },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal Server Error" });
  });
});

describe("GET /api/content/:id", () => {
  it("serializes the complete content response", async () => {
    const { app, contents } = buildTestApp();
    const createdAt = new Date("2026-01-02T03:04:05.000Z");
    const updatedAt = new Date("2026-01-02T03:05:06.000Z");
    contents.seed(
      makeContent({
        id: CONTENT_ID,
        userId: USER_ID,
        topic: "gatos",
        status: "COMPLETED",
        resultUrl: "http://minio:9000/bucket/result.txt",
        createdAt,
        updatedAt,
      })
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/content/${CONTENT_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: CONTENT_ID,
      requestId: expect.any(String),
      userId: USER_ID,
      topic: "gatos",
      status: "COMPLETED",
      resultUrl: "http://minio:9000/bucket/result.txt",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("reflects the FAILED shape (status FAILED, resultUrl null)", async () => {
    const { app, contents } = buildTestApp();
    contents.seed(makeContent({ id: CONTENT_ID, userId: USER_ID, status: "FAILED" }));

    const response = await app.inject({
      method: "GET",
      url: `/api/content/${CONTENT_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("FAILED");
    expect(body.resultUrl).toBeNull();
  });

  it("returns 404 for an unknown id", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/content/22222222-2222-2222-2222-222222222222",
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 400 for an invalid content id", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/content/not-a-uuid",
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /api/content/:id/cancel", () => {
  it("cancels content currently being processed", async () => {
    const { app, contents } = buildTestApp();
    contents.seed(
      makeContent({ id: CONTENT_ID, userId: USER_ID, status: "PROCESSING" })
    );

    const response = await app.inject({
      method: "POST",
      url: `/api/content/${CONTENT_ID}/cancel`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: CONTENT_ID, status: "CANCELED" });
  });

  it("is idempotent over HTTP", async () => {
    const { app, contents } = buildTestApp();
    contents.seed(makeContent({ id: CONTENT_ID, userId: USER_ID, status: "PENDING" }));

    const first = await app.inject({
      method: "POST",
      url: `/api/content/${CONTENT_ID}/cancel`,
    });
    const second = await app.inject({
      method: "POST",
      url: `/api/content/${CONTENT_ID}/cancel`,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ id: CONTENT_ID, status: "CANCELED" });
  });

  it("returns 404 for an unknown content id", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: `/api/content/${CONTENT_ID}/cancel`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Content not found" });
  });

  it("returns the unchanged COMPLETED status when cancellation is too late", async () => {
    const { app, contents } = buildTestApp();
    contents.seed(
      makeContent({
        id: CONTENT_ID,
        userId: USER_ID,
        status: "COMPLETED",
        resultUrl: "http://minio/result.txt",
      })
    );

    const response = await app.inject({
      method: "POST",
      url: `/api/content/${CONTENT_ID}/cancel`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: CONTENT_ID, status: "COMPLETED" });
  });

  it("returns 400 for an invalid content id", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/content/not-a-uuid/cancel",
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("application endpoints", () => {
  it("returns the health status", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("serves Swagger UI at /docs", async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/docs" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });
});

import { describe, it, expect } from "vitest";
import type { Queue } from "bullmq";
import { buildApp } from "../app.js";
import { ContentGenerationService } from "../services/content-generation.service.js";
import { ContentStatusService } from "../services/content-status.service.js";
import type { GenerateContentJobData } from "../services/content-generation.service.js";
import {
  FakeUserRepository,
  FakeContentRepository,
  FakeQueue,
  makeUser,
  makeContent,
} from "../test-utils/fakes.js";

function buildTestApp() {
  const users = new FakeUserRepository();
  const contents = new FakeContentRepository();
  const queue = new FakeQueue();

  const app = buildApp({
    contentGenerationService: new ContentGenerationService(
      users,
      contents,
      queue as unknown as Queue<GenerateContentJobData>
    ),
    contentStatusService: new ContentStatusService(contents),
  });

  return { app, users, contents };
}

const USER_ID = "11111111-1111-1111-1111-111111111111";
const CONTENT_ID = "22222222-2222-2222-2222-222222222222";

describe("POST /api/content/generate", () => {
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
});

describe("GET /api/content/:id", () => {
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
});

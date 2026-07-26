import { describe, it, expect } from "vitest";
import type { Queue } from "bullmq";
import { ContentGenerationService } from "./content-generation.service.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.interface.js";
import { InsufficientCreditsError } from "./insufficient-credits.error.js";
import { UserNotFoundError } from "./user-not-found.error.js";
import { FakeUserRepository } from "../test-utils/fake-user-repository.js";
import { FakeContentRepository } from "../test-utils/fake-content-repository.js";
import { FakeQueue } from "../test-utils/fake-queue.js";
import { makeUser } from "../test-utils/make-user.js";

function buildService() {
  const users = new FakeUserRepository();
  const contents = new FakeContentRepository();
  const queue = new FakeQueue();
  const service = new ContentGenerationService(
    users,
    contents,
    queue as unknown as Queue<GenerateContentJobData>
  );
  return { users, contents, queue, service };
}

describe("ContentGenerationService.generate", () => {
  it("rejects with InsufficientCreditsError when the user has 0 credits, without creating content", async () => {
    const { users, contents, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 0 }));

    await expect(service.generate({ userId: "user-1", topic: "gatos" })).rejects.toThrow(
      InsufficientCreditsError
    );
    expect(await contents.findById("content-1")).toBeNull();
  });

  it("rejects with UserNotFoundError (not InsufficientCreditsError) when the user doesn't exist", async () => {
    const { contents, service } = buildService();

    await expect(service.generate({ userId: "missing-user", topic: "gatos" })).rejects.toThrow(
      UserNotFoundError
    );
    expect(await contents.findById("content-1")).toBeNull();
  });

  it("debits a credit, creates a PENDING content and enqueues a job on success", async () => {
    const { users, queue, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 1 }));

    const result = await service.generate({ userId: "user-1", topic: "gatos" });

    expect(result.status).toBe("PENDING");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]?.data).toEqual({ contentId: result.contentId });
  });
});

describe("UserRepository.decrementCredits concurrency", () => {
  it("with credits = 1, exactly one of N concurrent calls succeeds", async () => {
    const { users } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 1 }));

    const results = await Promise.all(
      Array.from({ length: 5 }, () => users.decrementCredits("user-1"))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => !r)).toHaveLength(4);
  });
});

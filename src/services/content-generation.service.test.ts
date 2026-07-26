import { describe, it, expect } from "vitest";
import type { Queue } from "bullmq";
import type { ContentStatus } from "@prisma/client";
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
    const { users, contents, queue, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 0 }));

    await expect(service.generate({ userId: "user-1", topic: "gatos" })).rejects.toThrow(
      InsufficientCreditsError
    );
    expect(await contents.findById("content-1")).toBeNull();
    expect(queue.jobs).toHaveLength(0);
  });

  it("rejects with UserNotFoundError (not InsufficientCreditsError) when the user doesn't exist", async () => {
    const { contents, queue, service } = buildService();

    await expect(service.generate({ userId: "missing-user", topic: "gatos" })).rejects.toThrow(
      UserNotFoundError
    );
    expect(await contents.findById("content-1")).toBeNull();
    expect(queue.jobs).toHaveLength(0);
  });

  it("debits a credit, creates a PENDING content and enqueues a job on success", async () => {
    const { users, queue, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 1 }));

    const result = await service.generate({ userId: "user-1", topic: "gatos" });

    expect(result.status).toBe("PENDING");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]?.data).toEqual({ contentId: result.contentId });
  });

  it("debits exactly one credit and persists the original user and topic", async () => {
    const { users, contents, queue, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 2 }));

    const result = await service.generate({ userId: "user-1", topic: "arquitetura limpa" });

    expect((await users.findById("user-1"))?.credits).toBe(1);
    expect(await contents.findById(result.contentId)).toMatchObject({
      userId: "user-1",
      topic: "arquitetura limpa",
      status: "PENDING",
    });
    expect(queue.jobs[0]).toEqual({
      name: "generate-content",
      data: { contentId: result.contentId },
    });
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

  it("allows only one complete generation and enqueues only one job with one credit", async () => {
    const { users, contents, queue, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 1 }));

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        service.generate({ userId: "user-1", topic: `topic-${index}` })
      )
    );

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<{ contentId: string; status: ContentStatus }> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(rejected.every((result) => result.reason instanceof InsufficientCreditsError)).toBe(
      true
    );
    expect(queue.jobs).toHaveLength(1);
    expect(await contents.findById(fulfilled[0]!.value.contentId)).not.toBeNull();
  });
});

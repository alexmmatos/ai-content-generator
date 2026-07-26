import { describe, expect, it } from "vitest";
import { ContentGenerationService } from "./content-generation.service.js";
import { InsufficientCreditsError } from "./insufficient-credits.error.js";
import { RequestIdConflictError } from "./request-id-conflict.error.js";
import { UserNotFoundError } from "./user-not-found.error.js";
import { FakeContentRepository } from "../test-utils/fake-content-repository.js";
import { FakeGenerationRequestRepository } from "../test-utils/fake-generation-request-repository.js";
import { FakeUserRepository } from "../test-utils/fake-user-repository.js";
import { makeUser } from "../test-utils/make-user.js";

const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function buildService() {
  const users = new FakeUserRepository();
  const contents = new FakeContentRepository();
  const requests = new FakeGenerationRequestRepository(users, contents);
  const service = new ContentGenerationService(requests);
  return { users, contents, service };
}

describe("ContentGenerationService.generate", () => {
  it("rejects without creating content when the user has no credits", async () => {
    const { users, contents, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 0 }));

    await expect(
      service.generate({
        requestId: REQUEST_ID,
        userId: "user-1",
        topic: "gatos",
      })
    ).rejects.toThrow(InsufficientCreditsError);

    expect(contents.findByRequestIdSync(REQUEST_ID)).toBeNull();
    expect((await users.findById("user-1"))?.credits).toBe(0);
  });

  it("rejects with UserNotFoundError when the user does not exist", async () => {
    const { contents, service } = buildService();

    await expect(
      service.generate({
        requestId: REQUEST_ID,
        userId: "missing-user",
        topic: "gatos",
      })
    ).rejects.toThrow(UserNotFoundError);

    expect(contents.findByRequestIdSync(REQUEST_ID)).toBeNull();
  });

  it("debits one credit and creates a PENDING request", async () => {
    const { users, contents, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 2 }));

    const result = await service.generate({
      requestId: REQUEST_ID,
      userId: "user-1",
      topic: "arquitetura limpa",
    });

    expect(result).toMatchObject({
      requestId: REQUEST_ID,
      status: "PENDING",
      replayed: false,
    });
    expect((await users.findById("user-1"))?.credits).toBe(1);
    expect(await contents.findById(result.contentId)).toMatchObject({
      requestId: REQUEST_ID,
      userId: "user-1",
      topic: "arquitetura limpa",
      status: "PENDING",
    });
  });

  it("replays the original response without a second debit", async () => {
    const { users, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 2 }));
    const input = {
      requestId: REQUEST_ID,
      userId: "user-1",
      topic: "gatos",
    };

    const first = await service.generate(input);
    const replay = await service.generate(input);

    expect(replay).toEqual({ ...first, replayed: true });
    expect((await users.findById("user-1"))?.credits).toBe(1);
  });

  it("rejects reuse of a request ID with a different payload", async () => {
    const { users, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 2 }));

    await service.generate({
      requestId: REQUEST_ID,
      userId: "user-1",
      topic: "gatos",
    });

    await expect(
      service.generate({
        requestId: REQUEST_ID,
        userId: "user-1",
        topic: "cachorros",
      })
    ).rejects.toThrow(RequestIdConflictError);
    expect((await users.findById("user-1"))?.credits).toBe(1);
  });

  it("serializes concurrent requests with the same request ID into one debit", async () => {
    const { users, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 2 }));
    const input = {
      requestId: REQUEST_ID,
      userId: "user-1",
      topic: "gatos",
    };

    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.generate(input))
    );

    expect(new Set(results.map((result) => result.contentId))).toHaveLength(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(4);
    expect((await users.findById("user-1"))?.credits).toBe(1);
  });

  it("allows only one distinct request when five requests share one credit", async () => {
    const { users, service } = buildService();
    users.seed(makeUser({ id: "user-1", credits: 1 }));

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        service.generate({
          requestId: `00000000-0000-4000-8000-00000000000${index}`,
          userId: "user-1",
          topic: `topic-${index}`,
        })
      )
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(
      rejected.every(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof InsufficientCreditsError
      )
    ).toBe(true);
  });
});

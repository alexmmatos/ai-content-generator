import { describe, it, expect } from "vitest";
import { ContentStatusService } from "./content-status.service.js";
import { ContentNotFoundError } from "./content-not-found.error.js";
import { FakeContentRepository } from "../test-utils/fake-content-repository.js";
import { makeContent } from "../test-utils/make-content.js";

function buildService() {
  const contents = new FakeContentRepository();
  return { contents, service: new ContentStatusService(contents) };
}

describe("ContentStatusService.getById", () => {
  it("throws ContentNotFoundError for an unknown id", async () => {
    const { service } = buildService();
    await expect(service.getById("missing")).rejects.toThrow(ContentNotFoundError);
  });
});

describe("ContentStatusService retry-vs-cancel guard", () => {
  it("markProcessing called twice in a row (simulated BullMQ retry) returns PROCESSING both times, never null", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    const first = await service.markProcessing("c1");
    const second = await service.markProcessing("c1");

    expect(first?.status).toBe("PROCESSING");
    expect(second?.status).toBe("PROCESSING");
  });

  it("cancel then markProcessing: markProcessing returns null, content stays CANCELED", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await service.cancel("c1");
    const processing = await service.markProcessing("c1");

    expect(processing).toBeNull();
    expect((await service.getById("c1")).status).toBe("CANCELED");
  });

  it("markProcessing -> cancel -> markCompleted: markCompleted returns null, final state is CANCELED", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await service.markProcessing("c1");
    await service.cancel("c1");
    const completed = await service.markCompleted("c1", "http://example.com/x.txt");

    expect(completed).toBeNull();
    expect((await service.getById("c1")).status).toBe("CANCELED");
  });

  it("markProcessing -> cancel -> markFailed: markFailed returns null, final state is CANCELED", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await service.markProcessing("c1");
    await service.cancel("c1");
    const failed = await service.markFailed("c1");

    expect(failed).toBeNull();
    expect((await service.getById("c1")).status).toBe("CANCELED");
  });
});

describe("ContentStatusService.cancel idempotency", () => {
  it("cancel called twice does not throw and stays CANCELED", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await service.cancel("c1");
    const second = await service.cancel("c1");

    expect(second.status).toBe("CANCELED");
  });

  it("cancel on an already-COMPLETED content is a no-op that returns the current state", async () => {
    const { contents, service } = buildService();
    contents.seed(
      makeContent({ id: "c1", status: "COMPLETED", resultUrl: "http://example.com/x.txt" })
    );

    const result = await service.cancel("c1");

    expect(result.status).toBe("COMPLETED");
  });

  it("cancel on an already-FAILED content is a no-op that returns the current state", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "FAILED" }));

    const result = await service.cancel("c1");

    expect(result.status).toBe("FAILED");
  });
});

import { describe, it, expect, vi } from "vitest";
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

describe("ContentStatusService status transitions", () => {
  it("transitions PROCESSING to COMPLETED and saves the result URL", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PROCESSING" }));

    const completed = await service.markCompleted("c1", "http://example.com/result.txt");

    expect(completed).toMatchObject({
      status: "COMPLETED",
      resultUrl: "http://example.com/result.txt",
    });
  });

  it("does not transition a terminal COMPLETED content to FAILED", async () => {
    const { contents, service } = buildService();
    contents.seed(
      makeContent({
        id: "c1",
        status: "COMPLETED",
        resultUrl: "http://example.com/result.txt",
      })
    );

    expect(await service.markFailed("c1")).toBeNull();
    expect(await service.getById("c1")).toMatchObject({
      status: "COMPLETED",
      resultUrl: "http://example.com/result.txt",
    });
  });

  it.each(["COMPLETED", "CANCELED", "FAILED"] as const)(
    "does not move terminal status %s back to PROCESSING",
    async (status) => {
      const { contents, service } = buildService();
      contents.seed(makeContent({ id: "c1", status }));

      expect(await service.markProcessing("c1")).toBeNull();
      expect((await service.getById("c1")).status).toBe(status);
    }
  );

  it("returns null when the worker receives an unknown content id", async () => {
    const { service } = buildService();

    expect(await service.markProcessing("missing")).toBeNull();
    expect(await service.markCompleted("missing", "http://example.com/result.txt")).toBeNull();
    expect(await service.markFailed("missing")).toBeNull();
  });

  it("finalizes failure from PENDING and treats missing content as settled", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await expect(service.finalizeFailure("c1")).resolves.toBe("marked_failed");
    await expect(service.finalizeFailure("missing")).resolves.toBe("already_terminal");
  });

  it("keeps the legacy markFailed result for a successful finalization", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await expect(service.markFailed("c1")).resolves.toMatchObject({
      status: "FAILED",
    });
  });

  it("requests reconciliation when a non-terminal compare-and-set loses unexpectedly", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PROCESSING" }));
    vi.spyOn(contents, "markFailed").mockResolvedValueOnce(null);

    await expect(service.finalizeFailure("c1")).resolves.toBe("retry_required");
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
  it("throws ContentNotFoundError when canceling an unknown id", async () => {
    const { service } = buildService();

    await expect(service.cancel("missing")).rejects.toThrow(ContentNotFoundError);
  });

  it("cancel called twice does not throw and stays CANCELED", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));

    await service.cancel("c1");
    const second = await service.cancel("c1");

    expect(second).toMatchObject({
      content: { status: "CANCELED" },
      canceled: false,
    });
  });

  it("cancel on an already-COMPLETED content is a no-op that returns the current state", async () => {
    const { contents, service } = buildService();
    contents.seed(
      makeContent({ id: "c1", status: "COMPLETED", resultUrl: "http://example.com/x.txt" })
    );

    const result = await service.cancel("c1");

    expect(result).toMatchObject({
      content: { status: "COMPLETED" },
      canceled: false,
    });
  });

  it("cancel on an already-FAILED content is a no-op that returns the current state", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "FAILED" }));

    const result = await service.cancel("c1");

    expect(result).toMatchObject({
      content: { status: "FAILED" },
      canceled: false,
    });
  });

  it("preserves the result URL when cancel is attempted after completion", async () => {
    const { contents, service } = buildService();
    contents.seed(
      makeContent({
        id: "c1",
        status: "COMPLETED",
        resultUrl: "http://example.com/result.txt",
      })
    );

    const result = await service.cancel("c1");

    expect(result).toMatchObject({
      content: {
        status: "COMPLETED",
        resultUrl: "http://example.com/result.txt",
      },
      canceled: false,
    });
  });

  it("reports when a cancel transition was applied", async () => {
    const { contents, service } = buildService();
    contents.seed(makeContent({ id: "c1", status: "PROCESSING" }));

    const result = await service.cancel("c1");

    expect(result).toMatchObject({
      content: { status: "CANCELED" },
      canceled: true,
    });
  });
});

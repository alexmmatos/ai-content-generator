import { describe, it, expect, vi } from "vitest";
import { processContentGenerationJob } from "./process-content-generation-job.js";
import { ContentStatusService } from "../../application/content-status.service.js";
import { FakeContentRepository } from "../../test-utils/fakes/fake-content-repository.js";
import { makeContent } from "../../test-utils/builders/make-content.js";

const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeStorage() {
  return {
    keyFor: vi.fn((contentId: string) => `content/${contentId}.txt`),
    upload: vi.fn(async () => ({
      key: "content/c1.txt",
      url: "http://minio/x.txt",
    })),
    delete: vi.fn(async () => undefined),
  };
}

describe("processContentGenerationJob", () => {
  it("happy path: PENDING -> PROCESSING -> COMPLETED with the uploaded resultUrl", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const contentStorage = makeStorage();

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      contentStorage,
    });

    expect(simulateAiCall).toHaveBeenCalledWith("gatos");
    expect(contentStorage.upload).toHaveBeenCalledWith({
      contentId: "c1",
      text: "texto gerado",
      requestId: REQUEST_ID,
    });
    expect(contentStorage.delete).not.toHaveBeenCalled();
    const final = await statusService.getById("c1");
    expect(final.status).toBe("COMPLETED");
    expect(final.resultUrl).toBe("http://minio/x.txt");
  });

  it("already CANCELED before processing: never calls the AI or the upload", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", status: "CANCELED" }));

    const simulateAiCall = vi.fn();
    const contentStorage = makeStorage();

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      contentStorage,
    });

    expect(simulateAiCall).not.toHaveBeenCalled();
    expect(contentStorage.upload).not.toHaveBeenCalled();
    expect(contentStorage.delete).toHaveBeenCalledWith("content/c1.txt");
    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });

  it.each(["COMPLETED", "FAILED"] as const)(
    "terminal content in %s is ignored without calling external dependencies",
    async (status) => {
      const contents = new FakeContentRepository();
      const statusService = new ContentStatusService(contents);
      contents.seed(makeContent({ id: "c1", status }));

      const simulateAiCall = vi.fn();
      const contentStorage = makeStorage();

      await processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        contentStorage,
      });

      expect(simulateAiCall).not.toHaveBeenCalled();
      expect(contentStorage.upload).not.toHaveBeenCalled();
      expect(contentStorage.delete).not.toHaveBeenCalled();
      expect((await statusService.getById("c1")).status).toBe(status);
    }
  );

  it("canceled mid-flight (during the simulated AI call): stays CANCELED, not COMPLETED", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockImplementation(async () => {
      await statusService.cancel("c1");
      return "texto gerado";
    });
    const contentStorage = makeStorage();

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      contentStorage,
    });

    expect(contentStorage.upload).toHaveBeenCalled();
    expect(contentStorage.delete).toHaveBeenCalledWith("content/c1.txt");
    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });

  it("propagates an AI failure for BullMQ to retry and leaves the content PROCESSING", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockRejectedValue(new Error("AI unavailable"));
    const contentStorage = makeStorage();

    await expect(
      processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        contentStorage,
      })
    ).rejects.toThrow("AI unavailable");

    expect(contentStorage.upload).not.toHaveBeenCalled();
    expect((await statusService.getById("c1")).status).toBe("PROCESSING");
  });

  it("propagates an upload failure for BullMQ to retry and leaves the content PROCESSING", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const contentStorage = makeStorage();
    contentStorage.upload.mockRejectedValueOnce(new Error("S3 unavailable"));

    await expect(
      processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        contentStorage,
      })
    ).rejects.toThrow("S3 unavailable");

    expect((await statusService.getById("c1")).status).toBe("PROCESSING");
  });

  it("stays CANCELED when cancellation happens during upload", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const contentStorage = makeStorage();
    contentStorage.upload.mockImplementationOnce(async () => {
      await statusService.cancel("c1");
      return {
        key: "content/c1.txt",
        url: "http://minio/result.txt",
      };
    });

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      contentStorage,
    });

    expect(await statusService.getById("c1")).toMatchObject({
      status: "CANCELED",
      resultUrl: null,
    });
    expect(contentStorage.delete).toHaveBeenCalledWith("content/c1.txt");
  });

  it("propagates cleanup failure so BullMQ can retry orphan deletion", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));
    const contentStorage = makeStorage();
    const simulateAiCall = vi.fn().mockImplementation(async () => {
      await statusService.cancel("c1");
      return "texto gerado";
    });
    contentStorage.delete.mockRejectedValueOnce(new Error("delete unavailable"));

    await expect(
      processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        contentStorage,
      })
    ).rejects.toThrow("delete unavailable");

    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });
});

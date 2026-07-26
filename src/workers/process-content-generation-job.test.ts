import { describe, it, expect, vi } from "vitest";
import { processContentGenerationJob } from "./process-content-generation-job.js";
import { ContentStatusService } from "../services/content-status.service.js";
import { FakeContentRepository } from "../test-utils/fake-content-repository.js";
import { makeContent } from "../test-utils/make-content.js";

const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("processContentGenerationJob", () => {
  it("happy path: PENDING -> PROCESSING -> COMPLETED with the uploaded resultUrl", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const uploadContentFile = vi.fn().mockResolvedValue("http://minio/x.txt");

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      uploadContentFile,
    });

    expect(simulateAiCall).toHaveBeenCalledWith("gatos");
    expect(uploadContentFile).toHaveBeenCalledWith("c1", "texto gerado", REQUEST_ID);
    const final = await statusService.getById("c1");
    expect(final.status).toBe("COMPLETED");
    expect(final.resultUrl).toBe("http://minio/x.txt");
  });

  it("already CANCELED before processing: never calls the AI or the upload", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", status: "CANCELED" }));

    const simulateAiCall = vi.fn();
    const uploadContentFile = vi.fn();

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      uploadContentFile,
    });

    expect(simulateAiCall).not.toHaveBeenCalled();
    expect(uploadContentFile).not.toHaveBeenCalled();
    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });

  it.each(["COMPLETED", "FAILED"] as const)(
    "terminal content in %s is ignored without calling external dependencies",
    async (status) => {
      const contents = new FakeContentRepository();
      const statusService = new ContentStatusService(contents);
      contents.seed(makeContent({ id: "c1", status }));

      const simulateAiCall = vi.fn();
      const uploadContentFile = vi.fn();

      await processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        uploadContentFile,
      });

      expect(simulateAiCall).not.toHaveBeenCalled();
      expect(uploadContentFile).not.toHaveBeenCalled();
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
    const uploadContentFile = vi.fn().mockResolvedValue("http://minio/x.txt");

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      uploadContentFile,
    });

    expect(uploadContentFile).toHaveBeenCalled();
    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });

  it("propagates an AI failure for BullMQ to retry and leaves the content PROCESSING", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockRejectedValue(new Error("AI unavailable"));
    const uploadContentFile = vi.fn();

    await expect(
      processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        uploadContentFile,
      })
    ).rejects.toThrow("AI unavailable");

    expect(uploadContentFile).not.toHaveBeenCalled();
    expect((await statusService.getById("c1")).status).toBe("PROCESSING");
  });

  it("propagates an upload failure for BullMQ to retry and leaves the content PROCESSING", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const uploadContentFile = vi.fn().mockRejectedValue(new Error("S3 unavailable"));

    await expect(
      processContentGenerationJob("c1", REQUEST_ID, {
        statusService,
        simulateAiCall,
        uploadContentFile,
      })
    ).rejects.toThrow("S3 unavailable");

    expect((await statusService.getById("c1")).status).toBe("PROCESSING");
  });

  it("stays CANCELED when cancellation happens during upload", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const uploadContentFile = vi.fn().mockImplementation(async () => {
      await statusService.cancel("c1");
      return "http://minio/result.txt";
    });

    await processContentGenerationJob("c1", REQUEST_ID, {
      statusService,
      simulateAiCall,
      uploadContentFile,
    });

    expect(await statusService.getById("c1")).toMatchObject({
      status: "CANCELED",
      resultUrl: null,
    });
  });
});

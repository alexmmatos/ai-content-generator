import { describe, it, expect, vi } from "vitest";
import { processContentGenerationJob } from "./process-content-generation-job.js";
import { ContentStatusService } from "../services/content-status.service.js";
import { FakeContentRepository } from "../test-utils/fake-content-repository.js";
import { makeContent } from "../test-utils/make-content.js";

describe("processContentGenerationJob", () => {
  it("happy path: PENDING -> PROCESSING -> COMPLETED with the uploaded resultUrl", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockResolvedValue("texto gerado");
    const uploadContentFile = vi.fn().mockResolvedValue("http://minio/x.txt");

    await processContentGenerationJob("c1", { statusService, simulateAiCall, uploadContentFile });

    expect(simulateAiCall).toHaveBeenCalledWith("gatos");
    expect(uploadContentFile).toHaveBeenCalledWith("c1", "texto gerado");
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

    await processContentGenerationJob("c1", { statusService, simulateAiCall, uploadContentFile });

    expect(simulateAiCall).not.toHaveBeenCalled();
    expect(uploadContentFile).not.toHaveBeenCalled();
    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });

  it("canceled mid-flight (during the simulated AI call): stays CANCELED, not COMPLETED", async () => {
    const contents = new FakeContentRepository();
    const statusService = new ContentStatusService(contents);
    contents.seed(makeContent({ id: "c1", topic: "gatos", status: "PENDING" }));

    const simulateAiCall = vi.fn().mockImplementation(async () => {
      // simulates /cancel being called while the worker is "waiting on the AI"
      await statusService.cancel("c1");
      return "texto gerado";
    });
    const uploadContentFile = vi.fn().mockResolvedValue("http://minio/x.txt");

    await processContentGenerationJob("c1", { statusService, simulateAiCall, uploadContentFile });

    // the upload still happens (no rollback), but the final DB state stays CANCELED
    expect(uploadContentFile).toHaveBeenCalled();
    expect((await statusService.getById("c1")).status).toBe("CANCELED");
  });
});

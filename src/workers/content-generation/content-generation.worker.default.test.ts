import { describe, expect, it, vi } from "vitest";
import type { Job, Processor } from "bullmq";
import type { GenerateContentJobData } from "../../types/queue/generate-content-job-data.interface.js";

const workerState = vi.hoisted(() => ({
  processor: undefined as Processor<GenerateContentJobData> | undefined,
  failedListener: undefined as
    | ((job: Job<GenerateContentJobData> | undefined) => Promise<void>)
    | undefined,
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(
      _name: string,
      processor: Processor<GenerateContentJobData>
    ) {
      workerState.processor = processor;
    }

    on(
      _event: "failed",
      listener: (job: Job<GenerateContentJobData> | undefined) => Promise<void>
    ) {
      workerState.failedListener = listener;
    }

    async close() {
      return undefined;
    }
  },
}));

import { FakeContentRepository } from "../../test-utils/fakes/fake-content-repository.js";
import { makeContent } from "../../test-utils/builders/make-content.js";
import { ContentStatusService } from "../../services/status/content-status.service.js";
import { createContentGenerationWorker } from "./content-generation.worker.js";

describe("createContentGenerationWorker defaults", () => {
  it("uses the real Worker factory and console logger defaults", async () => {
    const contents = new FakeContentRepository();
    contents.seed(makeContent({ id: "c1", status: "PENDING" }));
    contents.seed(makeContent({ id: "c2", status: "PROCESSING" }));
    const statusService = new ContentStatusService(contents);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const worker = createContentGenerationWorker({
      connection: {},
      statusService,
      contentStorage: {
        keyFor: (contentId) => `content/${contentId}.txt`,
        upload: vi.fn().mockResolvedValue({
          key: "content/c1.txt",
          url: "http://minio/content/c1.txt",
        }),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      simulateAiCall: vi.fn().mockResolvedValue("texto"),
    });

    if (!workerState.processor || !workerState.failedListener) {
      throw new Error("default Worker callbacks were not registered");
    }
    await workerState.processor({
      id: "job-1",
      data: { contentId: "c1", requestId: "request-1" },
    } as unknown as Job<GenerateContentJobData>);
    await workerState.failedListener({
      id: "job-2",
      name: "generate-content",
      data: { contentId: "c2", requestId: "request-2" },
      attemptsMade: 3,
      opts: { attempts: 3 },
      updateData: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<GenerateContentJobData>);
    await worker.close();

    expect(log).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    expect((await statusService.getById("c2")).status).toBe("FAILED");
    log.mockRestore();
    error.mockRestore();
  });
});

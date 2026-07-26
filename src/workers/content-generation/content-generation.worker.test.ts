import { describe, expect, it, vi } from "vitest";
import type { Job, Processor } from "bullmq";
import { FakeContentRepository } from "../../test-utils/fakes/fake-content-repository.js";
import { makeContent } from "../../test-utils/builders/make-content.js";
import { ContentStatusService } from "../../services/status/content-status.service.js";
import type { GenerateContentJobData } from "../../types/queue/generate-content-job-data.interface.js";
import { createContentGenerationWorker } from "./content-generation.worker.js";

function makeStorage() {
  return {
    keyFor: vi.fn((contentId: string) => `content/${contentId}.txt`),
    upload: vi.fn(async () => ({
      key: "content/c1.txt",
      url: "http://minio/content/c1.txt",
    })),
    delete: vi.fn(async () => undefined),
  };
}

describe("createContentGenerationWorker", () => {
  it("wires the processor and terminal failed listener", async () => {
    const contents = new FakeContentRepository();
    contents.seed(makeContent({ id: "c1", status: "PENDING", topic: "gatos" }));
    contents.seed(makeContent({ id: "c2", status: "PROCESSING" }));
    const statusService = new ContentStatusService(contents);
    const storage = makeStorage();
    const simulateAiCall = vi.fn().mockResolvedValue("texto");
    const logger = { info: vi.fn(), error: vi.fn() };
    let processor: Processor<GenerateContentJobData> | undefined;
    let failedListener:
      | ((job: Job<GenerateContentJobData> | undefined) => Promise<void>)
      | undefined;
    let receivedQueueName = "";
    const worker = {
      on: vi.fn(
        (
          _event: "failed",
          listener: (job: Job<GenerateContentJobData> | undefined) => Promise<void>
        ) => {
          failedListener = listener;
        }
      ),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const result = createContentGenerationWorker({
      connection: {},
      statusService,
      contentStorage: storage,
      simulateAiCall,
      queueName: "isolated-queue",
      logger,
      workerFactory: (name, receivedProcessor) => {
        receivedQueueName = name;
        processor = receivedProcessor;
        return worker;
      },
    });

    expect(result).toBe(worker);
    expect(receivedQueueName).toBe("isolated-queue");
    if (!processor || !failedListener) throw new Error("worker callbacks were not wired");

    await processor({
      id: "job-1",
      data: { contentId: "c1", requestId: "request-1" },
    } as unknown as Job<GenerateContentJobData>);
    expect((await statusService.getById("c1")).status).toBe("COMPLETED");
    expect(logger.info).toHaveBeenCalledOnce();

    await failedListener(undefined);
    await processor({
      id: "cleanup-1",
      name: "cleanup-content",
      data: { contentId: "c1", requestId: "request-1" },
    } as unknown as Job<GenerateContentJobData>);
    expect(storage.delete).toHaveBeenCalledWith("content/c1.txt");

    await failedListener({
      id: "cleanup-1",
      name: "cleanup-content",
      data: { contentId: "c1", requestId: "request-1" },
      attemptsMade: 10,
      opts: { attempts: 10 },
    } as unknown as Job<GenerateContentJobData>);
    await failedListener({
      id: "job-2",
      name: "generate-content",
      data: { contentId: "c2", requestId: "request-2" },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as unknown as Job<GenerateContentJobData>);
    expect((await statusService.getById("c2")).status).toBe("PROCESSING");

    await failedListener({
      id: "job-2",
      name: "generate-content",
      data: { contentId: "c2", requestId: "request-2" },
      attemptsMade: 3,
      opts: { attempts: 3 },
      updateData: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<GenerateContentJobData>);
    expect((await statusService.getById("c2")).status).toBe("FAILED");
    expect(logger.error).toHaveBeenCalledWith(
      "Content generation exhausted retries",
      expect.objectContaining({ contentId: "c2", requestId: "request-2" })
    );
  });

  it("logs a persistence failure from the failed listener", async () => {
    const statusService = new ContentStatusService(new FakeContentRepository());
    vi.spyOn(statusService, "finalizeFailure").mockRejectedValueOnce(
      new Error("database unavailable")
    );
    const logger = { info: vi.fn(), error: vi.fn() };
    let failedListener:
      | ((job: Job<GenerateContentJobData> | undefined) => Promise<void>)
      | undefined;

    createContentGenerationWorker({
      connection: {},
      statusService,
      contentStorage: makeStorage(),
      logger,
      workerFactory: (_name, _processor) => ({
        on: (_event, listener) => {
          failedListener = listener;
        },
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    if (!failedListener) throw new Error("failed listener was not wired");
    await failedListener({
      id: "job-1",
      name: "generate-content",
      data: { contentId: "c1", requestId: "request-1" },
      attemptsMade: 3,
      opts: { attempts: 3 },
      updateData: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<GenerateContentJobData>);

    expect(logger.error).toHaveBeenLastCalledWith(
      "Failed to persist terminal content status",
      expect.objectContaining({ contentId: "c1", error: expect.any(Error) })
    );
  });

  it("leaves terminal persistence unmarked when reconciliation is still required", async () => {
    const statusService = new ContentStatusService(new FakeContentRepository());
    vi.spyOn(statusService, "finalizeFailure").mockResolvedValue("retry_required");
    let failedListener:
      | ((job: Job<GenerateContentJobData> | undefined) => Promise<void>)
      | undefined;
    createContentGenerationWorker({
      connection: {},
      statusService,
      contentStorage: makeStorage(),
      logger: { info: vi.fn(), error: vi.fn() },
      workerFactory: (_name, _processor) => ({
        on: (_event, listener) => {
          failedListener = listener;
        },
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const updateData = vi.fn();
    if (!failedListener) throw new Error("failed listener was not wired");

    await failedListener({
      id: "job-1",
      name: "generate-content",
      data: { contentId: "c1", requestId: "request-1" },
      attemptsMade: 3,
      opts: { attempts: 3 },
      updateData,
    } as unknown as Job<GenerateContentJobData>);

    expect(updateData).not.toHaveBeenCalled();
  });
});

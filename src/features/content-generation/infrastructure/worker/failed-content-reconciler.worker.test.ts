import { afterEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import { FakeContentRepository } from "../../test-utils/fakes/fake-content-repository.js";
import { makeContent } from "../../test-utils/builders/make-content.js";
import { ContentStatusService } from "../../application/content-status.service.js";
import type { GenerateContentJobData } from "../queue/generate-content-job-data.interface.js";
import { createFailedContentReconciler } from "./failed-content-reconciler.worker.js";

function makeJob(
  overrides: Partial<Job<GenerateContentJobData>> = {}
): Job<GenerateContentJobData> {
  return {
    id: "job-1",
    name: "generate-content",
    data: { contentId: "content-1", requestId: "request-1" },
    attemptsMade: 3,
    opts: { attempts: 3 },
    updateData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Job<GenerateContentJobData>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createFailedContentReconciler", () => {
  it("paginates failed jobs and marks terminal persistence", async () => {
    const contents = new FakeContentRepository();
    contents.seed(makeContent({ id: "content-1", status: "PROCESSING" }));
    const job = makeJob();
    const queue = {
      getJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValueOnce([]),
    };
    const reconciler = createFailedContentReconciler({
      queue,
      statusService: new ContentStatusService(contents),
      batchSize: 1,
    });

    await reconciler.reconcileNow();

    expect((await contents.findById("content-1"))?.status).toBe("FAILED");
    expect(job.updateData).toHaveBeenCalledWith({
      ...job.data,
      terminalStatusPersisted: true,
    });
    expect(queue.getJobs).toHaveBeenNthCalledWith(2, ["failed"], 1, 1, true);
  });

  it("skips cleanup, reconciled and non-terminal jobs", async () => {
    const queue = {
      getJobs: vi.fn().mockResolvedValue([
        makeJob({ name: "cleanup-content" }),
        makeJob({
          id: "job-2",
          data: {
            contentId: "content-2",
            requestId: "request-2",
            terminalStatusPersisted: true,
          },
        }),
        makeJob({ id: "job-3", attemptsMade: 1 }),
      ]),
    };
    const statusService = new ContentStatusService(new FakeContentRepository());
    const finalize = vi.spyOn(statusService, "finalizeFailure");

    await createFailedContentReconciler({
      queue,
      statusService,
    }).reconcileNow();

    expect(finalize).not.toHaveBeenCalled();
  });

  it("leaves retry-required and database failures pending", async () => {
    const retryJob = makeJob();
    const errorJob = makeJob({
      id: "job-2",
      data: { contentId: "content-2", requestId: "request-2" },
    });
    const queue = { getJobs: vi.fn().mockResolvedValue([retryJob, errorJob]) };
    const statusService = new ContentStatusService(new FakeContentRepository());
    vi.spyOn(statusService, "finalizeFailure")
      .mockResolvedValueOnce("retry_required")
      .mockRejectedValueOnce(new Error("database unavailable"));
    const logger = { error: vi.fn() };

    await createFailedContentReconciler({
      queue,
      statusService,
      logger,
    }).reconcileNow();

    expect(retryJob.updateData).not.toHaveBeenCalled();
    expect(errorJob.updateData).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed content reconciliation failed",
      expect.objectContaining({
        contentId: "content-2",
        error: expect.any(Error),
      })
    );
  });

  it("prevents overlapping runs", async () => {
    let release: (() => void) | undefined;
    const queue = {
      getJobs: vi.fn(
        () =>
          new Promise<Job<GenerateContentJobData>[]>((resolve) => {
            release = () => resolve([]);
          })
      ),
    };
    const reconciler = createFailedContentReconciler({
      queue,
      statusService: new ContentStatusService(new FakeContentRepository()),
    });

    const first = reconciler.reconcileNow();
    const second = reconciler.reconcileNow();

    expect(second).toBe(first);
    expect(queue.getJobs).toHaveBeenCalledOnce();
    if (!release) throw new Error("reconciliation did not start");
    release();
    await first;
    await reconciler.close();
  });

  it("starts immediately, schedules once and waits for active close", async () => {
    let scheduled: (() => void) | undefined;
    let release: (() => void) | undefined;
    const handle = {} as ReturnType<typeof setInterval>;
    const timer = {
      set: vi.fn((callback: () => void) => {
        scheduled = callback;
        return handle;
      }),
      clear: vi.fn(),
    };
    const queue = {
      getJobs: vi.fn(
        () =>
          new Promise<Job<GenerateContentJobData>[]>((resolve) => {
            release = () => resolve([]);
          })
      ),
    };
    const reconciler = createFailedContentReconciler({
      queue,
      statusService: new ContentStatusService(new FakeContentRepository()),
      timer,
      intervalMs: 25,
    });

    reconciler.start();
    reconciler.start();
    expect(timer.set).toHaveBeenCalledWith(expect.any(Function), 25);
    if (!scheduled || !release) throw new Error("reconciler was not scheduled");
    scheduled();
    const closing = reconciler.close();
    release();
    await closing;

    expect(timer.clear).toHaveBeenCalledWith(handle);
  });

  it("uses the system timer and default logger", async () => {
    vi.useFakeTimers();
    const queue = {
      getJobs: vi.fn().mockRejectedValueOnce(new Error("Redis unavailable")),
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reconciler = createFailedContentReconciler({
      queue,
      statusService: new ContentStatusService(new FakeContentRepository()),
      intervalMs: 10,
    });

    reconciler.start();
    await vi.advanceTimersByTimeAsync(10);
    await reconciler.close();

    expect(error).toHaveBeenCalledWith(
      "Failed content reconciliation scan failed",
      { error: expect.any(Error) }
    );
    error.mockRestore();
  });
});

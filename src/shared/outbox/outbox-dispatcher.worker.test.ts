import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutboxDispatcher } from "./outbox-dispatcher.worker.js";

function makePublisher() {
  return { publishPending: vi.fn().mockResolvedValue(undefined) };
}

describe("createOutboxDispatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts immediately, schedules polling once and closes its timer", async () => {
    const publisher = makePublisher();
    let scheduled: (() => void) | undefined;
    const handle = {} as ReturnType<typeof setInterval>;
    const timer = {
      set: vi.fn((callback: () => void) => {
        scheduled = callback;
        return handle;
      }),
      clear: vi.fn(),
    };
    const dispatcher = createOutboxDispatcher({
      publisher,
      intervalMs: 250,
      timer,
    });

    dispatcher.close();
    dispatcher.start();
    dispatcher.start();
    await vi.waitFor(() => expect(publisher.publishPending).toHaveBeenCalledOnce());
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(timer.set).toHaveBeenCalledWith(expect.any(Function), 250);

    if (!scheduled) throw new Error("poll callback was not scheduled");
    scheduled();
    await vi.waitFor(() => expect(publisher.publishPending).toHaveBeenCalledTimes(2));

    dispatcher.close();
    dispatcher.close();
    expect(timer.clear).toHaveBeenCalledWith(handle);
  });

  it("prevents overlapping dispatches", async () => {
    let resolvePending: (() => void) | undefined;
    const publisher = makePublisher();
    publisher.publishPending.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePending = () => resolve([]);
        })
    );
    const dispatcher = createOutboxDispatcher({
      publisher,
    });

    const first = dispatcher.dispatchNow();
    await dispatcher.dispatchNow();
    expect(publisher.publishPending).toHaveBeenCalledOnce();

    if (!resolvePending) throw new Error("pending dispatch was not started");
    resolvePending();
    await first;
  });

  it("logs repository errors and allows the next dispatch", async () => {
    const publisher = makePublisher();
    publisher.publishPending
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce([]);
    const logger = { error: vi.fn() };
    const dispatcher = createOutboxDispatcher({
      publisher,
      logger,
    });

    await dispatcher.dispatchNow();
    await dispatcher.dispatchNow();

    expect(logger.error).toHaveBeenCalledWith(
      "Outbox dispatcher failed",
      expect.any(Error)
    );
    expect(publisher.publishPending).toHaveBeenCalledTimes(2);
  });

  it("uses and clears the system interval by default", async () => {
    vi.useFakeTimers();
    const publisher = makePublisher();
    const dispatcher = createOutboxDispatcher({
      publisher,
      intervalMs: 10,
    });

    dispatcher.start();
    await vi.advanceTimersByTimeAsync(10);
    dispatcher.close();

    expect(publisher.publishPending).toHaveBeenCalled();
  });
});

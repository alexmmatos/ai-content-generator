import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OUTBOX_NOTIFY_CHANNEL } from "./outbox-channel.js";

const pgClientConstructor = vi.hoisted(() => vi.fn());

vi.mock("pg", () => ({
  Client: class extends EventEmitter {
    connect = vi.fn().mockResolvedValue(undefined);
    query = vi.fn().mockResolvedValue(undefined);
    end = vi.fn().mockResolvedValue(undefined);
    constructor(...args: unknown[]) {
      super();
      pgClientConstructor(...args);
    }
  },
}));

const { createOutboxListener } = await import("./outbox-listener.js");

class FakeClient extends EventEmitter {
  connect = vi.fn().mockResolvedValue(undefined);
  query = vi.fn().mockResolvedValue(undefined);
  end = vi.fn().mockResolvedValue(undefined);
}

describe("createOutboxListener", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects and issues LISTEN on the outbox channel", async () => {
    const client = new FakeClient();
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      clientFactory: () => client,
    });

    await listener.start();

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    await listener.close();
  });

  it("calls onNotify exactly once per notification received", async () => {
    const client = new FakeClient();
    const onNotify = vi.fn();
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify,
      clientFactory: () => client,
    });

    await listener.start();
    client.emit("notification", { channel: OUTBOX_NOTIFY_CHANNEL });
    client.emit("notification", { channel: OUTBOX_NOTIFY_CHANNEL });

    expect(onNotify).toHaveBeenCalledTimes(2);
    await listener.close();
  });

  it("reconnects and re-issues LISTEN after a connection error", async () => {
    vi.useFakeTimers();
    const first = new FakeClient();
    const second = new FakeClient();
    const clients = [first, second];
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      reconnectDelayMs: 500,
      logger: { error: vi.fn() },
      clientFactory: () => clients.shift() ?? second,
    });

    await listener.start();
    first.emit("error", new Error("connection reset"));

    await vi.advanceTimersByTimeAsync(500);

    expect(second.connect).toHaveBeenCalledOnce();
    expect(second.query).toHaveBeenCalledWith(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    await listener.close();
  });

  it("retries when the initial connect rejects", async () => {
    vi.useFakeTimers();
    const failing = new FakeClient();
    failing.connect.mockRejectedValueOnce(new Error("refused"));
    const succeeding = new FakeClient();
    const clients = [failing, succeeding];
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      reconnectDelayMs: 200,
      logger: { error: vi.fn() },
      clientFactory: () => clients.shift() ?? succeeding,
    });

    await listener.start();
    await vi.advanceTimersByTimeAsync(200);

    expect(succeeding.connect).toHaveBeenCalledOnce();
    await listener.close();
  });

  it("close() during a pending reconnect stops the timer and does not reconnect", async () => {
    vi.useFakeTimers();
    const first = new FakeClient();
    const second = new FakeClient();
    const clients = [first, second];
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      reconnectDelayMs: 500,
      logger: { error: vi.fn() },
      clientFactory: () => clients.shift() ?? second,
    });

    await listener.start();
    first.emit("end");
    await listener.close();
    await vi.advanceTimersByTimeAsync(500);

    expect(second.connect).not.toHaveBeenCalled();
  });

  it("a second error before the reconnect timer fires does not schedule a second reconnect", async () => {
    vi.useFakeTimers();
    const first = new FakeClient();
    const second = new FakeClient();
    const clients = [first, second];
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      reconnectDelayMs: 500,
      logger: { error: vi.fn() },
      clientFactory: () => clients.shift() ?? second,
    });

    await listener.start();
    first.emit("error", new Error("connection reset"));
    first.emit("end");

    await vi.advanceTimersByTimeAsync(500);

    expect(second.connect).toHaveBeenCalledOnce();
    await listener.close();
  });

  it("does not adopt a connection that finishes connecting after close() already ran", async () => {
    const client = new FakeClient();
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      clientFactory: () => client,
    });

    const starting = listener.start();
    await listener.close();
    await starting;

    expect(client.end).toHaveBeenCalledOnce();

    await listener.close();
    expect(client.end).toHaveBeenCalledOnce();
  });

  it("close() ends the active connection exactly once", async () => {
    const client = new FakeClient();
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
      clientFactory: () => client,
    });

    await listener.start();
    await listener.close();
    await listener.close();

    expect(client.end).toHaveBeenCalledOnce();
  });

  it("without an injected factory, connects using a real pg.Client for the given connection string", async () => {
    const listener = createOutboxListener({
      connectionString: "postgres://localhost/db",
      onNotify: vi.fn(),
    });

    await listener.start();

    expect(pgClientConstructor).toHaveBeenCalledWith({
      connectionString: "postgres://localhost/db",
    });
    await listener.close();
  });
});

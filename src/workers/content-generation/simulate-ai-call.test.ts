import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiSimulator } from "./simulate-ai-call.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createAiSimulator", () => {
  it("waits five seconds and returns generated text for a successful call", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.2);

    const result = createAiSimulator()("arquitetura limpa");

    await vi.advanceTimersByTimeAsync(4999);
    let settled = false;
    void result.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toContain('Conteúdo gerado sobre "arquitetura limpa"');
  });

  it("rejects when the random value falls inside the 20% failure range", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.199);

    const result = createAiSimulator()("gatos");
    const rejection = expect(result).rejects.toThrow("Simulated AI failure");
    await vi.advanceTimersByTimeAsync(5000);

    await rejection;
  });

  it("supports deterministic zero and full failure rates", async () => {
    await expect(
      createAiSimulator({ delayMs: 0, failureRate: 0, random: () => 0 })("ok")
    ).resolves.toContain('"ok"');
    await expect(
      createAiSimulator({ delayMs: 0, failureRate: 1, random: () => 0.999 })("fail")
    ).rejects.toThrow("Simulated AI failure");
  });
});

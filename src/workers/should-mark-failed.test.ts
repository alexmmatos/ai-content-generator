import { describe, it, expect } from "vitest";
import { shouldMarkFailed } from "./should-mark-failed.js";

describe("shouldMarkFailed", () => {
  it("returns false while attemptsMade is below the configured attempts", () => {
    expect(shouldMarkFailed({ attemptsMade: 1, opts: { attempts: 3 } })).toBe(false);
    expect(shouldMarkFailed({ attemptsMade: 2, opts: { attempts: 3 } })).toBe(false);
  });

  it("returns true once attemptsMade reaches the configured attempts (last attempt failed)", () => {
    expect(shouldMarkFailed({ attemptsMade: 3, opts: { attempts: 3 } })).toBe(true);
  });

  it("treats a missing opts.attempts as 1 attempt", () => {
    expect(shouldMarkFailed({ attemptsMade: 1, opts: {} })).toBe(true);
  });

  it("continues returning true if attemptsMade exceeds the configured attempts", () => {
    expect(shouldMarkFailed({ attemptsMade: 4, opts: { attempts: 3 } })).toBe(true);
  });
});

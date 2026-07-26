import type { IntervalTimer } from "./interval-timer.interface.js";

export const systemTimer: IntervalTimer = {
  set: (callback, intervalMs) => setInterval(callback, intervalMs),
  clear: (handle) => clearInterval(handle),
};

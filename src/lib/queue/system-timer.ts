import type { IntervalTimer } from "../../types/queue/interval-timer.interface.js";

export const systemTimer: IntervalTimer = {
  set: (callback, intervalMs) => setInterval(callback, intervalMs),
  clear: (handle) => clearInterval(handle),
};

export interface IntervalTimer {
  set(callback: () => void, intervalMs: number): ReturnType<typeof setInterval>;
  clear(handle: ReturnType<typeof setInterval>): void;
}

import type { RetryInfo } from "../types/queue/retry-info.interface.js";

export function shouldMarkFailed(job: RetryInfo): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= maxAttempts;
}

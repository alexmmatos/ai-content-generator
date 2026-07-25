export interface RetryInfo {
  attemptsMade: number;
  opts: { attempts?: number };
}

/** Decides whether a BullMQ job's retries are exhausted (last attempt failed) — pulled out
 *  as a pure function so it's testable without a real BullMQ `Job`/Redis connection. */
export function shouldMarkFailed(job: RetryInfo): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= maxAttempts;
}

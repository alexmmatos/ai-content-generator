const DEFAULT_JOB_RETENTION = { ageSeconds: 86_400, count: 1_000 };

export const LIMITS = {
  topic: {
    minLength: 1,
    maxLength: 500,
  },
  credits: {
    costPerGeneration: 1,
  },
  contentGenerationJob: {
    attempts: 3,
    backoffDelayMs: 2000,
    completedRetention: DEFAULT_JOB_RETENTION,
  },
  outboxPublishing: {
    batchSize: 50,
  },
  outboxCleanupJob: {
    attempts: 10,
    backoffDelayMs: 2000,
    completedRetention: DEFAULT_JOB_RETENTION,
  },
  aiSimulation: {
    delayMs: 5000,
    defaultFailureRate: 0.2,
    minFailureRate: 0,
    maxFailureRate: 1,
  },
  outboxPolling: {
    defaultIntervalMs: 1000,
  },
  failedReconciliation: {
    defaultIntervalMs: 5000,
  },
} as const;

import { describe, expect, it } from "vitest";
import { parseWorkerEnv } from "./parse-worker-env.js";

const WORKER_ENV = {
  DATABASE_URL: "postgresql://localhost/database",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_PUBLIC_URL: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "content",
  S3_ACCESS_KEY_ID: "access",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("parseWorkerEnv", () => {
  it("applies worker defaults and coerces configured values", () => {
    expect(
      parseWorkerEnv({
        ...WORKER_ENV,
        NODE_ENV: "test",
        OUTBOX_POLL_INTERVAL_MS: "250",
        FAILED_RECONCILIATION_INTERVAL_MS: "750",
        SIMULATED_AI_FAILURE_RATE: "0",
      })
    ).toMatchObject({
      NODE_ENV: "test",
      OUTBOX_POLL_INTERVAL_MS: 250,
      FAILED_RECONCILIATION_INTERVAL_MS: 750,
      SIMULATED_AI_FAILURE_RATE: 0,
    });
  });

  it("rejects infrastructure values missing from the worker", () => {
    expect(() =>
      parseWorkerEnv({ DATABASE_URL: "postgresql://localhost/database" })
    ).toThrow();
  });

  it("rejects a simulated failure rate outside zero and one", () => {
    expect(() =>
      parseWorkerEnv({ ...WORKER_ENV, SIMULATED_AI_FAILURE_RATE: "1.1" })
    ).toThrow();
  });
});

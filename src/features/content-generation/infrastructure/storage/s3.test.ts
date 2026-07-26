import { describe, expect, it, vi } from "vitest";
import { createS3Client } from "./s3.js";

const s3Constructor = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(...args: unknown[]) {
      s3Constructor(...args);
    }
  },
}));

describe("createS3Client", () => {
  it("creates a path-style S3 client from explicit configuration", () => {
    createS3Client({
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "access",
      S3_SECRET_ACCESS_KEY: "secret",
    });

    expect(s3Constructor).toHaveBeenCalledWith({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: "access",
        secretAccessKey: "secret",
      },
    });
  });
});

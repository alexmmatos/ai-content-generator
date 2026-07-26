import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("./s3.js", () => ({
  s3Client: { send: sendMock },
}));

vi.mock("./env.js", () => ({
  env: {
    S3_BUCKET: "content-bucket",
    S3_PUBLIC_URL: "http://localhost:9000",
  },
}));

import { S3ContentStorage } from "./upload-content-file.js";

describe("S3ContentStorage", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  it("uploads a text file under the content id and returns its public URL", async () => {
    const storage = new S3ContentStorage(
      { send: sendMock } as never,
      "content-bucket",
      "http://localhost:9000"
    );
    const result = await storage.upload({
      contentId: "content-1",
      text: "texto gerado",
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(result).toEqual({
      key: "content/content-1.txt",
      url: "http://localhost:9000/content-bucket/content/content-1.txt",
    });
    expect(sendMock).toHaveBeenCalledOnce();

    const command = sendMock.mock.calls[0]?.[0];
    expect(command.input).toEqual({
      Bucket: "content-bucket",
      Key: "content/content-1.txt",
      Body: "texto gerado",
      ContentType: "text/plain",
      Metadata: {
        "request-id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });
  });

  it("deletes an uploaded key idempotently through S3", async () => {
    const storage = new S3ContentStorage(
      { send: sendMock } as never,
      "content-bucket",
      "http://localhost:9000"
    );

    await storage.delete("content/content-1.txt");

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0]?.[0].input).toEqual({
      Bucket: "content-bucket",
      Key: "content/content-1.txt",
    });
  });

  it("builds deterministic keys from the content id", () => {
    const storage = new S3ContentStorage(
      { send: sendMock } as never,
      "content-bucket",
      "http://localhost:9000"
    );

    expect(storage.keyFor("content-1")).toBe("content/content-1.txt");
  });
});

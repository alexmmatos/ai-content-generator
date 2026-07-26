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

import { uploadContentFile } from "./upload-content-file.js";

describe("uploadContentFile", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  it("uploads a text file under the content id and returns its public URL", async () => {
    const result = await uploadContentFile(
      "content-1",
      "texto gerado",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );

    expect(result).toBe(
      "http://localhost:9000/content-bucket/content/content-1.txt"
    );
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
});

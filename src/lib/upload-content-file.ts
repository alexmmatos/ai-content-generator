import {
  DeleteObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import type {
  ContentStorage,
  UploadedContent,
} from "../types/content-storage.interface.js";

export class S3ContentStorage implements ContentStorage {
  constructor(
    private client: S3Client,
    private bucket: string,
    private publicUrl: string
  ) {}

  keyFor(contentId: string): string {
    return `content/${contentId}.txt`;
  }

  async upload(input: {
    contentId: string;
    requestId: string;
    text: string;
  }): Promise<UploadedContent> {
    const key = this.keyFor(input.contentId);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.text,
        ContentType: "text/plain",
        Metadata: {
          "request-id": input.requestId,
        },
      })
    );

    return {
      key,
      url: `${this.publicUrl}/${this.bucket}/${key}`,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}

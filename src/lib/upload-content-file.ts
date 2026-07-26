import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3.js";
import { env } from "./env.js";

export async function uploadContentFile(
  contentId: string,
  text: string,
  requestId: string
): Promise<string> {
  const key = `content/${contentId}.txt`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: text,
      ContentType: "text/plain",
      Metadata: {
        "request-id": requestId,
      },
    })
  );

  return `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/${key}`;
}

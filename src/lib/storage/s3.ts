import { S3Client } from "@aws-sdk/client-s3";
import type { WorkerEnv } from "../../types/env/worker-env.type.js";

export function createS3Client(config: Pick<
  WorkerEnv,
  "S3_ENDPOINT" | "S3_REGION" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY"
>): S3Client {
  return new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
}

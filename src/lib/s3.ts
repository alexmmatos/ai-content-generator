import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

// task.md allows either Minio locally or AWS S3 in prod; this project deliberately targets
// Minio only (everything runs local/docker, no external services) — forcePathStyle is
// hardcoded true because of that choice, not left conditional for a prod/AWS branch.
export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true, // Minio requires path-style addressing
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

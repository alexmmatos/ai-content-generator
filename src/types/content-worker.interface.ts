import type { Job } from "bullmq";
import type { GenerateContentJobData } from "./generate-content-job-data.interface.js";

export interface ContentWorker {
  on(
    event: "failed",
    listener: (job: Job<GenerateContentJobData> | undefined) => Promise<void>
  ): unknown;
  close(): Promise<void>;
}

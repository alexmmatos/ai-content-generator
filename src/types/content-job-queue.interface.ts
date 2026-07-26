import type { JobsOptions } from "bullmq";
import type { GenerateContentJobData } from "./generate-content-job-data.interface.js";

export interface ContentJobQueue {
  add(
    name: string,
    data: GenerateContentJobData,
    options: JobsOptions & { jobId: string }
  ): Promise<unknown>;
}

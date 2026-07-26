import type { Job } from "bullmq";
import type { GenerateContentJobData } from "../queue/generate-content-job-data.interface.js";

export interface FailedJobSource {
  getJobs(
    types: "failed"[],
    start: number,
    end: number,
    asc: boolean
  ): Promise<Array<Job<GenerateContentJobData>>>;
}

import type { Processor, WorkerOptions } from "bullmq";
import type { ContentWorker } from "./content-worker.interface.js";
import type { GenerateContentJobData } from "../queue/generate-content-job-data.interface.js";

export type WorkerFactory = (
  name: string,
  processor: Processor<GenerateContentJobData>,
  options: WorkerOptions
) => ContentWorker;

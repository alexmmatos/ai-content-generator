import type { ProcessJobDeps } from "../types/process-job-deps.interface.js";

export async function processContentGenerationJob(
  contentId: string,
  deps: ProcessJobDeps
): Promise<void> {
  const processing = await deps.statusService.markProcessing(contentId);
  if (!processing) return;

  const text = await deps.simulateAiCall(processing.topic);

  const resultUrl = await deps.uploadContentFile(contentId, text);

  await deps.statusService.markCompleted(contentId, resultUrl);
}

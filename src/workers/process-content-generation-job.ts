import type { ProcessJobDeps } from "../types/process-job-deps.interface.js";

export async function processContentGenerationJob(
  contentId: string,
  requestId: string,
  deps: ProcessJobDeps
): Promise<void> {
  const processing = await deps.statusService.markProcessing(contentId);
  if (!processing) {
    const current = await deps.statusService.findById(contentId);
    if (current?.status === "CANCELED") {
      await deps.contentStorage.delete(deps.contentStorage.keyFor(contentId));
    }
    return;
  }

  const text = await deps.simulateAiCall(processing.topic);

  const uploaded = await deps.contentStorage.upload({
    contentId,
    text,
    requestId,
  });

  const completed = await deps.statusService.markCompleted(contentId, uploaded.url);
  if (!completed) await deps.contentStorage.delete(uploaded.key);
}

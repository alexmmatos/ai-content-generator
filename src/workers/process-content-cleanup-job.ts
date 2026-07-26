import type { ContentStorage } from "../types/content-storage.interface.js";

export async function processContentCleanupJob(
  contentId: string,
  storage: ContentStorage
): Promise<void> {
  await storage.delete(storage.keyFor(contentId));
}

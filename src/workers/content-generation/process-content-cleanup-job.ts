import type { ContentStorage } from "../../types/storage/content-storage.interface.js";

export async function processContentCleanupJob(
  contentId: string,
  storage: ContentStorage
): Promise<void> {
  await storage.delete(storage.keyFor(contentId));
}

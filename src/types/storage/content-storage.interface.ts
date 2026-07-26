import type { UploadedContent } from "./uploaded-content.interface.js";

export interface ContentStorage {
  upload(input: {
    contentId: string;
    requestId: string;
    text: string;
  }): Promise<UploadedContent>;
  delete(key: string): Promise<void>;
  keyFor(contentId: string): string;
}

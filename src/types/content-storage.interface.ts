export interface UploadedContent {
  key: string;
  url: string;
}

export interface ContentStorage {
  upload(input: {
    contentId: string;
    requestId: string;
    text: string;
  }): Promise<UploadedContent>;
  delete(key: string): Promise<void>;
  keyFor(contentId: string): string;
}

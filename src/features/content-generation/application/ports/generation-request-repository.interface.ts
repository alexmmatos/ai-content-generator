import type { CreateGenerationRequestResult } from "./create-generation-request-result.type.js";

export interface GenerationRequestRepository {
  create(input: {
    requestId: string;
    requestHash: string;
    userId: string;
    topic: string;
  }): Promise<CreateGenerationRequestResult>;
}

import type { ContentStatus } from "@prisma/client";
import type { Queue } from "bullmq";
import type { UserRepository } from "../repositories/user.repository.js";
import type { ContentRepository } from "../repositories/content.repository.js";
import { InsufficientCreditsError } from "./errors.js";

export interface GenerateContentJobData {
  contentId: string;
}

export class ContentGenerationService {
  constructor(
    private users: UserRepository,
    private contents: ContentRepository,
    private queue: Queue<GenerateContentJobData>
  ) {}

  async generate(input: {
    userId: string;
    topic: string;
  }): Promise<{ contentId: string; status: ContentStatus }> {
    const debited = await this.users.decrementCredits(input.userId);
    if (!debited) throw new InsufficientCreditsError();

    const content = await this.contents.create(input);

    await this.queue.add("generate-content", { contentId: content.id });

    return { contentId: content.id, status: content.status };
  }
}

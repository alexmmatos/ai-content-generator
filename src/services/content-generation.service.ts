import type { ContentStatus } from "@prisma/client";
import type { Queue } from "bullmq";
import type { UserRepository } from "../types/user-repository.interface.js";
import type { ContentRepository } from "../types/content-repository.interface.js";
import type { GenerateContentJobData } from "../types/generate-content-job-data.interface.js";
import { InsufficientCreditsError } from "./insufficient-credits.error.js";
import { UserNotFoundError } from "./user-not-found.error.js";

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
    if (!debited) {
      // decrementCredits only tells us "0 rows affected" — this lookup is just to decide
      // which error to report, it doesn't reopen the debit race (that's already atomic).
      const user = await this.users.findById(input.userId);
      if (!user) throw new UserNotFoundError();
      throw new InsufficientCreditsError();
    }

    const content = await this.contents.create(input);

    await this.queue.add("generate-content", { contentId: content.id });

    return { contentId: content.id, status: content.status };
  }
}

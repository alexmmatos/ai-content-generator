import type { User } from "@prisma/client";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** Conditional UPDATE (credits > 0) in a single query — never read then write in
   *  separate steps, see .claude/rules/business-rules.md. Returns false if the user
   *  doesn't exist or had no credit left (0 rows affected). */
  decrementCredits(id: string): Promise<boolean>;
}

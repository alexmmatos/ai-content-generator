import type { UserEntity } from "../../domain/user/user.js";

export interface UserRepository {
  findById(id: string): Promise<UserEntity | null>;
  decrementCredits(id: string): Promise<boolean>;
}

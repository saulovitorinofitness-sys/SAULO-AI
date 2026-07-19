import type { BaseEntity, EntityId, PageRequest, PageResult } from "../shared";

export type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "INACTIVE";

export interface User extends BaseEntity {
  readonly fullName: string;
  readonly email?: string;
  readonly status: UserStatus;
}

export interface UserRepository {
  findById(id: EntityId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(page: PageRequest): Promise<PageResult<User>>;
}

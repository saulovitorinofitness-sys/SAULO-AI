import type { BaseEntity, EntityId, JsonValue } from "../shared";

export type ProfileType = "SYSTEM_OWNER" | "PROFESSIONAL" | "ADMINISTRATIVE";

export interface UserProfile extends BaseEntity {
  readonly userId: EntityId;
  readonly type: ProfileType;
  readonly professionalRegistration?: string;
  readonly metadata?: JsonValue;
}

export interface ProfileRepository {
  findByUserId(userId: EntityId): Promise<UserProfile | null>;
}

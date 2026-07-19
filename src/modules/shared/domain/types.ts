export type EntityId = string;
export type ISODate = string;
export type ISODateTime = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface EntityTimestamps {
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

export interface BaseEntity extends EntityTimestamps {
  readonly id: EntityId;
}

export interface AuthoredEntity extends BaseEntity {
  readonly authorUserId: EntityId;
}

export interface AuditableRecord extends BaseEntity {
  readonly responsibleUserId: EntityId;
  readonly lastModifiedByUserId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly status: string;
  readonly version: number;
}

export interface PageRequest {
  readonly cursor?: string;
  readonly limit: number;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export const MODULE_KEYS = [
  "AUTHENTICATION",
  "USERS",
  "PROFILES",
  "PERMISSIONS",
  "PATIENTS",
  "MASTER_RECORD",
  "SCHEDULING",
  "ATTENDANCE",
  "BIOIMPEDANCE",
  "PERIMETRY",
  "PHYSICAL_ASSESSMENT",
  "POSTURAL_ASSESSMENT",
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
  "WORKOUT_PLAN",
  "REPORTS",
  "DELIVERABLES",
  "AUDIT",
  "CLINICAL_REASONING",
  "CLINICAL_EVOLUTION",
  "NUTRITION_EVOLUTION",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

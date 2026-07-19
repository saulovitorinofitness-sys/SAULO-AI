import type {
  BaseEntity,
  EntityId,
  ISODateTime,
  JsonValue,
  ModuleKey,
  PageRequest,
  PageResult,
} from "../shared";

export type AuditAction = "CREATE" | "UPDATE" | "STATUS_CHANGE" | "ARCHIVE" | "RESTORE";

export interface AuditChange {
  readonly fieldPath: string;
  readonly previousValue?: JsonValue;
  readonly newValue?: JsonValue;
}

export interface AuditEvent extends BaseEntity {
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly action: AuditAction;
  readonly createdByUserId: EntityId;
  readonly changedByUserId: EntityId;
  readonly occurredAt: ISODateTime;
  readonly reason?: string;
  readonly changes: readonly AuditChange[];
}

export interface RecordVersion extends BaseEntity {
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly responsibleUserId: EntityId;
  readonly version: number;
  readonly status: string;
  readonly snapshot: JsonValue;
  readonly reason?: string;
}

export interface AuditRepository {
  appendEvent(event: AuditEvent): Promise<void>;
  appendVersion(version: RecordVersion): Promise<void>;
  listEvents(entityType: string, entityId: EntityId, page: PageRequest): Promise<PageResult<AuditEvent>>;
  listVersions(entityType: string, entityId: EntityId): Promise<readonly RecordVersion[]>;
}

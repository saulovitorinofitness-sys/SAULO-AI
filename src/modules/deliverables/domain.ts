import type { AuditableRecord, EntityId, JsonValue } from "../shared";

export type DeliverableStatus = "DRAFT" | "READY" | "PUBLISHED" | "ARCHIVED";

export interface Deliverable extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly createdByUserId: EntityId;
  readonly kind: string;
  readonly title: string;
  readonly version: number;
  readonly status: DeliverableStatus;
  readonly storageKey?: string;
  readonly metadata?: JsonValue;
}

export interface DeliverableRepository {
  findById(id: EntityId): Promise<Deliverable | null>;
}

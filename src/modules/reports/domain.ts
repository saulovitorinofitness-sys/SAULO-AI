import type { AuditableRecord, EntityId, JsonValue } from "../shared";

export type ReportStatus = "DRAFT" | "GENERATING" | "READY" | "FAILED" | "ARCHIVED";

export interface Report extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly requestedByUserId: EntityId;
  readonly kind: string;
  readonly parameters?: JsonValue;
  readonly status: ReportStatus;
  readonly storageKey?: string;
}

export interface ReportRepository {
  findById(id: EntityId): Promise<Report | null>;
}

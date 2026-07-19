import type { AuditableRecord, EntityId, ISODateTime, PageRequest, PageResult } from "../shared";

export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface Appointment extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly professionalUserId: EntityId;
  readonly createdByUserId: EntityId;
  readonly startsAt: ISODateTime;
  readonly endsAt: ISODateTime;
  readonly status: AppointmentStatus;
  readonly notes?: string;
}

export interface SchedulingRepository {
  findById(id: EntityId): Promise<Appointment | null>;
  listForPeriod(from: ISODateTime, to: ISODateTime, page: PageRequest): Promise<PageResult<Appointment>>;
}

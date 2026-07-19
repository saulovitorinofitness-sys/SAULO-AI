import type { EntityId, ISODateTime, JsonValue } from "../shared";

export interface PhysicalAssessment {
  readonly entryId: EntityId;
  readonly assessedAt: ISODateTime;
  readonly observations: JsonValue;
  readonly notes?: string;
}

export interface PhysicalAssessmentRepository {
  findByEntryId(entryId: EntityId): Promise<PhysicalAssessment | null>;
}

import type { EntityId, ISODateTime, JsonValue } from "../shared";

export interface PosturalAssessment {
  readonly entryId: EntityId;
  readonly assessedAt: ISODateTime;
  readonly observations: JsonValue;
  readonly notes?: string;
}

export interface PosturalAssessmentRepository {
  findByEntryId(entryId: EntityId): Promise<PosturalAssessment | null>;
}

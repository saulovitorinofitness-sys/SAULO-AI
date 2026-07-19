import type { EntityId, ISODate, JsonValue } from "../shared";

export interface WorkoutPlan {
  readonly entryId: EntityId;
  readonly title: string;
  readonly validFrom?: ISODate;
  readonly validUntil?: ISODate;
  readonly content: JsonValue;
  readonly notes?: string;
}

export interface WorkoutPlanRepository {
  findByEntryId(entryId: EntityId): Promise<WorkoutPlan | null>;
}

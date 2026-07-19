import type { EntityId, ISODate, JsonValue } from "../shared";

export interface MealPlan {
  readonly entryId: EntityId;
  readonly title: string;
  readonly validFrom?: ISODate;
  readonly validUntil?: ISODate;
  readonly content: JsonValue;
  readonly notes?: string;
}

export interface MealPlanRepository {
  findByEntryId(entryId: EntityId): Promise<MealPlan | null>;
}

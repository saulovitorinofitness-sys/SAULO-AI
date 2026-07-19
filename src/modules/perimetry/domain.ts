import type { EntityId, ISODateTime, JsonValue } from "../shared";

export interface PerimetryRecord {
  readonly entryId: EntityId;
  readonly measuredAt: ISODateTime;
  readonly measurements: JsonValue;
  readonly notes?: string;
}

export interface PerimetryRepository {
  findByEntryId(entryId: EntityId): Promise<PerimetryRecord | null>;
}

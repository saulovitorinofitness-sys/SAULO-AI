import type { EntityId, ISODateTime, JsonValue } from "../shared";

export interface BioimpedanceRecord {
  readonly entryId: EntityId;
  readonly measuredAt: ISODateTime;
  readonly measurements: JsonValue;
  readonly notes?: string;
}

export interface BioimpedanceRepository {
  findByEntryId(entryId: EntityId): Promise<BioimpedanceRecord | null>;
}

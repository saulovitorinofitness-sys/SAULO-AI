import type { EntityId, ISODateTime } from "../shared";
import type {
  AdherenceCategory,
  EvolutionClassification,
  EvolutionDimension,
  ProtocolType,
} from "./domain";

export interface EvolutionProfessionalContextService {
  currentProfessionalUserId(): Promise<EntityId>;
}

export interface EvolutionClockService {
  now(): ISODateTime;
}

export interface ClinicalEvolutionAuthorizationService {
  assertCanOpen(professionalUserId: EntityId, masterRecordId: EntityId): Promise<void>;
  assertCanCompare(professionalUserId: EntityId, sessionId: EntityId): Promise<void>;
  assertCanRecordAdherence(professionalUserId: EntityId, categories: readonly AdherenceCategory[]): Promise<void>;
  assertCanManageProtocol(professionalUserId: EntityId, type: ProtocolType, nutritionExclusive: boolean): Promise<void>;
  assertCanRecordFactors(professionalUserId: EntityId, factorTypes: readonly string[]): Promise<void>;
  assertCanTrackAthlete(professionalUserId: EntityId, masterRecordId: EntityId): Promise<void>;
}

export interface EvolutionReferencePair {
  readonly dimension: EvolutionDimension;
  readonly comparisonKey: string;
  readonly currentEntryId?: EntityId;
  readonly previousEntryId?: EntityId;
}

export interface EvolutionDataReferenceService {
  collect(
    masterRecordId: EntityId,
    currentAttendanceId: EntityId,
    previousAttendanceId: EntityId | undefined,
    dimensions: readonly EvolutionDimension[],
  ): Promise<readonly EvolutionReferencePair[]>;
}

export interface EvolutionClassificationService {
  classify(referencePair: EvolutionReferencePair): Promise<EvolutionClassification>;
}

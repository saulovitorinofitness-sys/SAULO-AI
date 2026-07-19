import type { EntityId, ISODateTime } from "../shared";
import type { ClinicalFindingCategory, ClinicalPriorityLevel } from "./domain";

export interface ClinicalProfessionalContextService {
  currentProfessionalUserId(): Promise<EntityId>;
}

export interface ClinicalClockService {
  now(): ISODateTime;
}

export interface ClinicalReasoningAuthorizationService {
  assertCanOpen(professionalUserId: EntityId, attendanceId: EntityId): Promise<void>;
  assertCanContribute(professionalUserId: EntityId, sessionId: EntityId): Promise<void>;
  assertCanManageEvidence(professionalUserId: EntityId): Promise<void>;
}

export interface PriorityClassificationInput {
  readonly code: string;
  readonly label: string;
  readonly category: ClinicalFindingCategory;
}

export interface ClinicalPriorityClassifierService {
  classify(input: PriorityClassificationInput): Promise<ClinicalPriorityLevel>;
}

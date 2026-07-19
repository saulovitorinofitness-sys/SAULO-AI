import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { EntityId, ISODateTime } from "@/modules/shared";

export const LABORATORY_EXAM_CATEGORIES = [
  "BLOOD", "HORMONAL", "VITAMINS", "INFLAMMATORY_MARKERS", "RENAL_FUNCTION",
  "HEPATIC_FUNCTION", "LIPID_PROFILE", "GLYCEMIA", "THYROID", "OTHER",
] as const;

export type LaboratoryExamCategory = (typeof LABORATORY_EXAM_CATEGORIES)[number];
export type LaboratoryExamRecordStatus = "ACTIVE" | "REMOVED";
export type LaboratoryExamHistoryAction = "CREATED" | "UPDATED" | "REMOVED";

export interface LaboratoryExamRecord {
  readonly id: EntityId;
  readonly masterRecordId: EntityId;
  readonly patientId: EntityId;
  readonly category: LaboratoryExamCategory;
  readonly name: string;
  readonly result: string;
  readonly unit: string;
  readonly referenceValue: string;
  readonly collectedAt: string;
  readonly laboratory: string;
  readonly notes: string;
  readonly status: LaboratoryExamRecordStatus;
  readonly version: number;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly recordedBy: string;
}

export interface LaboratoryExamHistoryEntry {
  readonly id: EntityId;
  readonly examId: EntityId;
  readonly action: LaboratoryExamHistoryAction;
  readonly occurredAt: ISODateTime;
  readonly professionalName: string;
  readonly summary: string;
  readonly previousRecord?: LaboratoryExamRecord;
}

export interface LaboratoryExamsView {
  readonly patientId: EntityId;
  readonly patientName: string;
  readonly patientCode: string;
  readonly masterRecordId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly records: readonly LaboratoryExamRecord[];
  readonly history: readonly LaboratoryExamHistoryEntry[];
  readonly canRead: boolean;
  readonly canEdit: boolean;
  readonly connectedProfessionalName: string;
}

export interface LaboratoryExamAvailability {
  readonly status: "NONE" | "UPDATED" | "OLD";
  readonly exists: boolean;
  readonly latestCollectedAt?: string;
  readonly activeExamCount: number;
}

export type LaboratoryExamDraft = Pick<LaboratoryExamRecord, "category" | "name" | "result" | "unit" | "referenceValue" | "collectedAt" | "laboratory" | "notes">;

export interface GetLaboratoryExamsInput { readonly patientId: EntityId; readonly scenario: ClinicalCollectionScenarioKey; }
export interface SaveLaboratoryExamInput extends GetLaboratoryExamsInput { readonly examId?: EntityId; readonly data: LaboratoryExamDraft; }
export interface RemoveLaboratoryExamInput extends GetLaboratoryExamsInput { readonly examId: EntityId; }


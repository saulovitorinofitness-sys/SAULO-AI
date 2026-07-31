import type { ClinicalCollectionScenarioKey, ProfessionalAudit } from "@/features/clinical-collection";
import type { EntityId, ISODateTime } from "@/modules/shared";

export type AnamnesisObjective = "WEIGHT_LOSS" | "HYPERTROPHY" | "REHABILITATION" | "HEALTH" | "PERFORMANCE" | "CONDITIONING" | "OTHER";
export type ClinicalHistoryItem = "HYPERTENSION" | "DIABETES" | "DYSLIPIDEMIA" | "HEART_DISEASE" | "THYROID" | "OSTEOPOROSIS" | "HERNIA" | "ARTHROSIS" | "ARTHRITIS" | "ASTHMA" | "COPD" | "ANXIETY" | "DEPRESSION" | "OTHER";
export type FamilyHistoryItem = "DIABETES" | "HYPERTENSION" | "OBESITY" | "HEART_ATTACK" | "STROKE" | "CANCER" | "OSTEOPOROSIS" | "OTHER";

export interface AnamnesisSurgery { readonly id: string; readonly procedure: string; readonly date: string; readonly notes: string; }
export interface AnamnesisInjury { readonly id: string; readonly region: string; readonly date: string; readonly situation: string; readonly notes: string; }
export interface AnamnesisMedication { readonly id: string; readonly name: string; readonly dose: string; readonly frequency: string; readonly reason: string; }
export interface AnamnesisSupplement { readonly id: string; readonly name: string; readonly dose: string; readonly frequency: string; }

export interface ClinicalAnamnesisData {
  readonly chiefComplaint: string;
  readonly currentIllness: { readonly onset: string; readonly duration: string; readonly evolution: string; readonly previousTreatments: string; readonly currentSituation: string };
  readonly primaryObjective: AnamnesisObjective | "";
  readonly secondaryObjectives: readonly AnamnesisObjective[];
  readonly clinicalHistory: readonly ClinicalHistoryItem[];
  readonly clinicalHistoryNotes: string;
  readonly familyHistory: readonly FamilyHistoryItem[];
  readonly surgeries: readonly AnamnesisSurgery[];
  readonly injuries: readonly AnamnesisInjury[];
  readonly medications: readonly AnamnesisMedication[];
  readonly supplements: readonly AnamnesisSupplement[];
  readonly allergies: readonly string[];
  readonly sleep: { readonly hours: string; readonly quality: string; readonly awakenings: string };
  readonly stressLevel: number;
  readonly physicalActivity: { readonly frequency: string; readonly duration: string; readonly modality: string };
  readonly habits: { readonly alcohol: string; readonly smoking: string; readonly others: string };
  readonly nutrition: { readonly mealsPerDay: string; readonly water: string; readonly restrictions: string; readonly preferences: string };
  readonly generalNotes: string;
}

export interface AnamnesisHistoryEntry {
  readonly id: string;
  readonly version: number;
  readonly changedAt: ISODateTime;
  readonly changedBy: string;
  readonly summary: string;
  readonly data: ClinicalAnamnesisData;
}

export interface AnamnesisTimelineEntry { readonly id: string; readonly occurredAt: ISODateTime; readonly actorName: string; readonly title: string; readonly detail: string; }

export interface ClinicalAnamnesisView {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly attendanceId?: EntityId;
  readonly patientName: string;
  readonly patientCode: string;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly status: "DRAFT" | "COMPLETED";
  readonly version: number;
  readonly data: ClinicalAnamnesisData;
  readonly audit: ProfessionalAudit;
  readonly history: readonly AnamnesisHistoryEntry[];
  readonly timeline: readonly AnamnesisTimelineEntry[];
  readonly canRead: boolean;
  readonly canEdit: boolean;
  readonly canViewNutrition: boolean;
}

export interface GetClinicalAnamnesisInput { readonly patientId: EntityId; readonly scenario: ClinicalCollectionScenarioKey; }
export interface SaveClinicalAnamnesisInput extends GetClinicalAnamnesisInput { readonly data: ClinicalAnamnesisData; }

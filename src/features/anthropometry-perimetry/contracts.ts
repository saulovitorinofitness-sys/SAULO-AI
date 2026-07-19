import type { ClinicalCollectionScenarioKey, ProfessionalAudit } from "@/features/clinical-collection";
import type { EntityId, ISODateTime } from "@/modules/shared";

export type AnthropometryAssessmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "REVIEWED";
export type AnthropometryAssessmentType = "INITIAL" | "REASSESSMENT";
export type BodyRegion = "TRUNK" | "UPPER_LIMBS" | "LOWER_LIMBS";
export type BodySide = "RIGHT" | "LEFT";
export type AnthropometryScenarioKey = "COMPLETE" | "PARTIAL" | "REASSESSMENT";
export type PerimetryMeasurementKey =
  | "neck" | "shoulders" | "chest" | "waist" | "abdomen" | "hipGlutes"
  | "rightArmRelaxed" | "leftArmRelaxed" | "rightArmContracted" | "leftArmContracted"
  | "rightForearm" | "leftForearm" | "rightWrist" | "leftWrist"
  | "rightProximalThigh" | "leftProximalThigh" | "rightMedialThigh" | "leftMedialThigh"
  | "rightCalf" | "leftCalf";

export interface MeasurementOriginReference {
  readonly masterRecordId: EntityId;
  readonly sourceRecordId: EntityId;
  readonly sourceField: string;
  readonly sourceLabel: string;
}

export interface PerimetryMeasurement {
  readonly id: EntityId;
  readonly key: PerimetryMeasurementKey;
  readonly label: string;
  readonly region: BodyRegion;
  readonly side?: BodySide;
  readonly valueCm?: number;
  readonly notPerformed: boolean;
  readonly reason?: string;
  readonly notes?: string;
  readonly origin?: MeasurementOriginReference;
}

export interface AnthropometryAssessment {
  readonly id: EntityId;
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly type: AnthropometryAssessmentType;
  readonly status: AnthropometryAssessmentStatus;
  readonly assessmentDate: string;
  readonly professionalId: EntityId;
  readonly professionalName: string;
  readonly basicMeasurementsOrigin?: MeasurementOriginReference;
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly bmi?: number;
  readonly measurements: readonly PerimetryMeasurement[];
  readonly professionalNotes: string;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly version: number;
}

export interface AnthropometryPerimetryView {
  readonly patientId: EntityId;
  readonly patientName: string;
  readonly patientCode: string;
  readonly masterRecordId: EntityId;
  readonly attendanceId: EntityId;
  readonly collectionScenario: ClinicalCollectionScenarioKey;
  readonly scenario: AnthropometryScenarioKey;
  readonly currentAssessment: AnthropometryAssessment;
  readonly assessments: readonly AnthropometryAssessment[];
  readonly connectedProfessional: ProfessionalAudit;
  readonly canRead: boolean;
  readonly canEdit: boolean;
}

export interface GetAnthropometryPerimetryInput {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
}

export interface SaveAnthropometryAssessmentInput extends GetAnthropometryPerimetryInput {
  readonly assessment: AnthropometryAssessment;
  readonly action: "START" | "SAVE_DRAFT" | "COMPLETE" | "REVIEW";
}

export interface PerimetryMeasurementDefinition {
  readonly key: PerimetryMeasurementKey;
  readonly label: string;
  readonly region: BodyRegion;
  readonly side?: BodySide;
  readonly sourceField?: string;
}


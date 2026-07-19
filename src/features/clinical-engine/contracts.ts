import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { PatientHubTimelineEvent, PatientHubView } from "@/features/patient-hub";
import type { EntityId, ISODateTime } from "@/modules/shared";

export type ClinicalEngineSectionStatus = "COMPLETE" | "PENDING" | "RESTRICTED";

export interface ClinicalEngineMetric {
  readonly label: string;
  readonly value: string;
  readonly pending?: boolean;
}

export interface ClinicalEngineSection {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: ClinicalEngineSectionStatus;
  readonly metrics: readonly ClinicalEngineMetric[];
  readonly items?: readonly string[];
}

export interface ClinicalEngineView {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly hub: PatientHubView;
  readonly sections: readonly ClinicalEngineSection[];
  readonly timeline: readonly PatientHubTimelineEvent[];
  readonly completeSectionCount: number;
  readonly pendingSectionCount: number;
  readonly lastUpdatedAt: ISODateTime;
  readonly responsibleProfessional: string;
  readonly masterRecordVersion: string;
}


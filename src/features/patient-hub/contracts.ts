import type { ClinicalCollectionScenario, ClinicalCollectionScenarioKey, CurrentAttendanceView } from "@/features/clinical-collection";
import type { EntityId, ISODateTime } from "@/modules/shared";

export type PatientHubModuleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "REVIEWED" | "PENDING" | "BLOCKED" | "UNAVAILABLE";
export type PatientHubOperationalLevel = "INFORMATION" | "ATTENTION" | "PRIORITY";

export interface PatientHubHeaderView {
  readonly patientId: EntityId;
  readonly fullName: string;
  readonly code: string;
  readonly age: number;
  readonly sexLabel: string;
  readonly primaryObjective: string;
  readonly secondaryObjectives: readonly string[];
  readonly patientStatus: string;
  readonly responsibleProfessionalName: string;
  readonly lastAttendanceAt?: ISODateTime;
  readonly nextReturnAt?: ISODateTime;
  readonly followUpSince: string;
  readonly attendanceContext: string;
}

export interface PatientHubNextAction {
  readonly label: string;
  readonly description: string;
  readonly href: string;
}

export interface PatientHubModuleCard {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: PatientHubModuleStatus;
  readonly updatedAt?: ISODateTime;
  readonly professionalName?: string;
  readonly pendingCount?: number;
  readonly href?: string;
  readonly actionLabel?: "Abrir" | "Continuar";
  readonly blockedReason?: string;
  readonly visible: boolean;
}

export interface PatientHubOperationalItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly level: PatientHubOperationalLevel;
  readonly module: string;
}

export interface PatientHubRecordMetric {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  readonly value: string;
  readonly updatedAt?: string;
}

export interface PatientHubTimelineEvent {
  readonly id: string;
  readonly occurredAt: ISODateTime;
  readonly title: string;
  readonly description: string;
  readonly professionalName: string;
  readonly module: string;
  readonly href?: string;
}

export interface PatientHubQuickAction { readonly id: string; readonly label: string; readonly href: string; }

export interface PatientHubView {
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly scenarios: readonly ClinicalCollectionScenario[];
  readonly header: PatientHubHeaderView;
  readonly attendance: CurrentAttendanceView | null;
  readonly collectionCompleted: boolean;
  readonly posturalCompleted: boolean;
  readonly panelAccessible: boolean;
  readonly panelConfirmed: boolean;
  readonly motorAvailable: boolean;
  readonly professionalDecisionRegistered: boolean;
  readonly nextAction: PatientHubNextAction;
  readonly modules: readonly PatientHubModuleCard[];
  readonly alerts: readonly PatientHubOperationalItem[];
  readonly pendingItems: readonly PatientHubOperationalItem[];
  readonly recordSummary: readonly PatientHubRecordMetric[];
  readonly timeline: readonly PatientHubTimelineEvent[];
  readonly quickActions: readonly PatientHubQuickAction[];
  readonly canEditPatient: boolean;
  readonly showNutrition: boolean;
  readonly nutritionStrategyActive: boolean;
  readonly isAthlete: boolean;
  readonly showPerformance: boolean;
}

export interface GetPatientHubInput { readonly patientId: EntityId; readonly scenario: ClinicalCollectionScenarioKey; }

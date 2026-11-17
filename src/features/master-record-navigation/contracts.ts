import type { PatientHubView } from "@/features/patient-hub";

export type MasterRecordModuleId = "SUMMARY" | "ANAMNESIS" | "PHYSICAL_ASSESSMENT" | "POSTURAL_ASSESSMENT" | "ANTHROPOMETRY" | "PERIMETRY" | "BIOIMPEDANCE" | "LABORATORY_EXAMS" | "ATTENDANCES" | "CLINICAL_COLLECTION" | "CLINICAL_ENGINE" | "CLINICAL_PANEL" | "CLINICAL_DECISION" | "NUTRITION_STRATEGY" | "MEAL_PLAN" | "TRAINING_PLAN" | "EVOLUTION" | "DELIVERABLES" | "PERFORMANCE_ENDURANCE";
export type MasterRecordCategory = "GENERAL" | "COLLECTION_HISTORY" | "ASSESSMENTS" | "DECISION" | "PRESCRIPTIONS" | "DOCUMENTS" | "ATHLETE_CONTEXT";
export type MasterRecordNavigationStatus = "available" | "blocked" | "future" | "unavailable";
export type MasterRecordAudience = "AUTHORIZED_CLINICAL" | "NUTRITION" | "SAULO_ATHLETE";
export type MasterRecordRouteKind = "PATIENT_ROOT" | "ANAMNESIS" | "PHYSICAL_STEP" | "POSTURAL_STEP" | "ANTHROPOMETRY" | "PERIMETRY" | "BIOIMPEDANCE_STEP" | "LABORATORY_EXAMS" | "ATTENDANCE" | "COLLECTION" | "CLINICAL_ENGINE" | "CLINICAL_PANEL" | "CLINICAL_DECISION" | "NUTRITION_STRATEGY" | "MEAL_PLAN" | "EVALUATION_EVOLUTION" | "NONE" | "PERFORMANCE_ENDURANCE";

export interface MasterRecordModuleDefinition { readonly id: MasterRecordModuleId; readonly cardId: string; readonly label: string; readonly description: string; readonly order: number; readonly category: MasterRecordCategory; readonly route: MasterRecordRouteKind; readonly audience: MasterRecordAudience; readonly future: boolean; readonly hiddenWhenUnauthorized: boolean; readonly requiredPermission?: string; readonly prerequisite?: string; }
export interface ResolvedMasterRecordModule extends MasterRecordModuleDefinition { readonly href?: string; readonly status: MasterRecordNavigationStatus; readonly visible: boolean; readonly blockedReason?: string; }
export interface MasterRecordNavigationContext extends Pick<PatientHubView, "scenario" | "attendance" | "panelAccessible" | "motorAvailable" | "showNutrition" | "showPerformance" | "nutritionStrategyActive"> { readonly patientId: string; }

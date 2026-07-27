import type { ConsultationType } from "@/modules/attendance";
import type { EntityId, ISODateTime, ModuleKey } from "@/modules/shared";

export type ClinicalCollectionStepKey = "ANTHROPOMETRY" | "BIOIMPEDANCE" | "PERIMETRY" | "POSTURAL_ASSESSMENT" | "SUMMARY";
export type EditableClinicalStepKey = Exclude<ClinicalCollectionStepKey, "SUMMARY">;
export type CollectionStepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type SaveState = "IDLE" | "SAVING" | "SAVED" | "ERROR" | "UNSAVED";
export type MockViewerKey = "SAULO" | "MARIA";
export const CLINICAL_COLLECTION_SCENARIO_KEYS = ["not-started", "partial-saulo", "maria-continuity", "complete", "mandatory-pending", "integrity-missing", "previous-comparison"] as const;
export type ClinicalCollectionScenarioKey = (typeof CLINICAL_COLLECTION_SCENARIO_KEYS)[number];
export type AttendanceProgressStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "BLOCKED" | "NOT_APPLICABLE";
export type CurrentAttendanceActionKey = "START_COLLECTION" | "CONTINUE_COLLECTION" | "REVIEW_COLLECTION" | "OPEN_COLLECTION_SUMMARY" | "OPEN_CLINICAL_PANEL";
export type DataIntegrityIssueType = "REQUIRED_STEP_INCOMPLETE" | "REQUIRED_VALUE_MISSING" | "MISSING_AUTHOR" | "MISSING_DATE" | "STATUS_DATA_MISMATCH" | "POSTURAL_ASSESSMENT_MISSING" | "NOT_CONFIRMED";

export interface RecordOrigin {
  readonly masterRecordId: EntityId;
  readonly entryId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly label: string;
}

export interface ProfessionalAudit {
  readonly professionalUserId: EntityId;
  readonly professionalName: string;
  readonly updatedAt: ISODateTime;
  readonly version: number;
}

export interface ClinicalStepRecord<T> {
  readonly status: CollectionStepStatus;
  readonly data: T;
  readonly missingRequiredFields: readonly string[];
  readonly origin?: RecordOrigin;
  readonly audit?: ProfessionalAudit;
}

export interface AnthropometryData {
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly bmi?: number;
  readonly notes?: string;
}

export interface BioimpedanceAvanutriData {
  readonly weightKg?: number;
  readonly bodyFatPercent?: number;
  readonly fatMassKg?: number;
  readonly fatFreeMassKg?: number;
  readonly skeletalMuscleMassKg?: number;
  readonly totalBodyWaterL?: number;
  readonly intracellularWaterL?: number;
  readonly extracellularWaterL?: number;
  readonly bmi?: number;
  readonly visceralFatLevel?: number;
  readonly basalMetabolicRateKcal?: number;
  readonly appendicularIndex?: number;
  readonly metabolicAgeYears?: number;
  readonly proteinKg?: number;
  readonly mineralsKg?: number;
  readonly leanRightArmKg?: number;
  readonly leanLeftArmKg?: number;
  readonly leanTrunkKg?: number;
  readonly leanRightLegKg?: number;
  readonly leanLeftLegKg?: number;
  readonly fatRightArmKg?: number;
  readonly fatLeftArmKg?: number;
  readonly fatTrunkKg?: number;
  readonly fatRightLegKg?: number;
  readonly fatLeftLegKg?: number;
}

export interface PerimetryData {
  readonly neckCm?: number;
  readonly shouldersCm?: number;
  readonly chestCm?: number;
  readonly waistCm?: number;
  readonly abdomenCm?: number;
  readonly hipCm?: number;
  readonly rightArmCm?: number;
  readonly leftArmCm?: number;
  readonly rightForearmCm?: number;
  readonly leftForearmCm?: number;
  readonly rightThighCm?: number;
  readonly leftThighCm?: number;
  readonly rightCalfCm?: number;
  readonly leftCalfCm?: number;
  readonly notes?: string;
}

export type StructuredFindingState = "NOT_ASSESSED" | "NO_FINDING_RECORDED" | "FINDING_RECORDED";
export type PosturalViewKey = "ANTERIOR" | "POSTERIOR" | "RIGHT_LATERAL" | "LEFT_LATERAL";

export interface PosturalViewImage {
  /** Imagem original; a grade visual nunca é incorporada neste conteúdo. */
  readonly dataUrl: string;
  readonly fileName: string;
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly sizeBytes: number;
  readonly uploadedAt: ISODateTime;
}

export interface PosturalSymmetrograph {
  /** Preferências de visualização persistidas separadamente da imagem original. */
  readonly enabled: boolean;
  readonly opacity: number;
}

export type PosturalSegmentGrade =
  | "DISCREET"
  | "MODERATE"
  | "ACCENTUATED";
export type PosturalSegmentRelevance =
  | "NONE"
  | "LOW"
  | "MODERATE"
  | "HIGH";

export interface PosturalSegmentAssessment {
  readonly selectedOption?: string;
  readonly grade?: PosturalSegmentGrade;
  readonly observation?: string;
  readonly investigationSuggestions?: readonly string[];
  readonly otherInvestigation?: string;
  readonly relevance?: PosturalSegmentRelevance;
}

export interface PosturalViewData {
  readonly state: StructuredFindingState;
  readonly observation?: string;
  readonly image?: PosturalViewImage;
  readonly symmetrograph?: PosturalSymmetrograph;
  readonly segments?: Readonly<
    Record<string, PosturalSegmentAssessment>
  >;
}

export type PosturalCompletionStatus =
  | "IN_PROGRESS"
  | "COMPLETED";
export type PosturalOverallRelevance = "LOW" | "MODERATE" | "HIGH";
export type PosturalFollowUpConduct =
  | "REGISTER_ONLY"
  | "MONITOR_EVOLUTION"
  | "REASSESS_LATER"
  | "CONSIDER_IN_TRAINING"
  | "SUGGEST_COMPLEMENTARY_INVESTIGATION"
  | "SUGGEST_QUALIFIED_REFERRAL"
  | "OTHER";

export interface PosturalSummaryGeneration {
  readonly content: string;
  readonly generatedAt: ISODateTime;
}

export interface PosturalTechnicalSummary {
  readonly generatedOriginal?: string;
  readonly editedSummary?: string;
  readonly generatedAt?: ISODateTime;
  readonly lastEditedAt?: ISODateTime;
  readonly generationHistory?: readonly PosturalSummaryGeneration[];
}

export interface PosturalFollowUp {
  readonly conduct?: PosturalFollowUpConduct;
  readonly observation?: string;
  readonly suggestedReassessmentDate?: string;
  readonly reassessmentObservation?: string;
}

export interface PosturalAssessmentData {
  readonly views: Readonly<Record<PosturalViewKey, PosturalViewData>>;
  readonly identifiedChanges: StructuredFindingState;
  readonly identifiedChangesNotes?: string;
  readonly functionalLimitations: StructuredFindingState;
  readonly functionalLimitationsNotes?: string;
  readonly notes?: string;
  readonly futureCorrectiveExercisesNote?: string;
  readonly technicalSummary?: PosturalTechnicalSummary;
  readonly evaluatorConclusion?: string;
  readonly overallRelevance?: PosturalOverallRelevance;
  readonly followUp?: PosturalFollowUp;
  readonly completionStatus?: PosturalCompletionStatus;
}

export interface ClinicalCollectionRecords {
  readonly anthropometry: ClinicalStepRecord<AnthropometryData>;
  readonly bioimpedance: ClinicalStepRecord<BioimpedanceAvanutriData>;
  readonly perimetry: ClinicalStepRecord<PerimetryData>;
  readonly posturalAssessment: ClinicalStepRecord<PosturalAssessmentData>;
}

export interface PreviousPerimetryReference {
  readonly measuredAt: ISODateTime;
  readonly values: PerimetryData;
  readonly audit: ProfessionalAudit;
}

export interface ClinicalCollectionView {
  readonly patientId: EntityId;
  readonly patientName: string;
  readonly patientCode: string;
  readonly patientAge?: number;
  readonly patientSex?: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
  readonly patientPhone?: string;
  readonly attendanceId: EntityId;
  readonly masterRecordId: EntityId;
  readonly consultationType: ConsultationType;
  readonly connectedProfessional: ProfessionalAudit;
  readonly records: ClinicalCollectionRecords;
  readonly previousPerimetry?: PreviousPerimetryReference;
  readonly progressPercent: number;
  readonly nutritionFlowReady: boolean;
  readonly firstIncompleteStep: EditableClinicalStepKey | "SUMMARY";
  readonly lastSavedStep?: EditableClinicalStepKey;
  readonly canRead: boolean;
  readonly canEdit: boolean;
  readonly completed: boolean;
  readonly nextAttendanceStep?: string;
  readonly scenario: ClinicalCollectionScenarioKey;
}

export interface AttendanceProgressStep {
  readonly key: string;
  readonly label: string;
  readonly status: AttendanceProgressStatus;
  readonly statusLabel: string;
}

export interface CurrentAttendanceAction {
  readonly key: CurrentAttendanceActionKey;
  readonly label: string;
  readonly href: string;
  readonly primary: boolean;
}

export interface CurrentAttendanceView {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly consultationType: ConsultationType;
  readonly responsibleProfessionalName: string;
  readonly startedAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly progressPercent: number;
  readonly lastCompletedStep?: string;
  readonly nextPendingStep?: string;
  readonly status: "NOT_STARTED" | "IN_PROGRESS" | "COLLECTION_COMPLETE" | "INTEGRITY_PENDING";
  readonly statusLabel: string;
  readonly progress: readonly AttendanceProgressStep[];
  readonly actions: readonly CurrentAttendanceAction[];
}

export interface DataIntegrityIssue {
  readonly id: string;
  readonly type: DataIntegrityIssueType;
  readonly section: string;
  readonly message: string;
  readonly blocking: boolean;
}

export interface ClinicalPanelPatientContext {
  readonly fullName: string;
  readonly code: string;
  readonly age: number;
  readonly sexLabel: string;
  readonly mainObjective?: string;
}

export interface ClinicalPanelView {
  readonly collection: ClinicalCollectionView;
  readonly patient: ClinicalPanelPatientContext;
  readonly collectedAt?: ISODateTime;
  readonly integrityIssues: readonly DataIntegrityIssue[];
  readonly accessible: boolean;
  readonly confirmedAt?: ISODateTime;
  readonly confirmedBy?: ProfessionalAudit;
  readonly nextModule?: "Motor de Decisão Clínica";
}

export type EditableClinicalData = AnthropometryData | BioimpedanceAvanutriData | PerimetryData | PosturalAssessmentData;

export interface GetClinicalCollectionInput {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
  readonly scenario?: ClinicalCollectionScenarioKey;
}

export interface SaveClinicalStepInput {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly step: EditableClinicalStepKey;
  readonly data: EditableClinicalData;
}

export interface SaveClinicalStepResult {
  readonly collection: ClinicalCollectionView;
  readonly savedAt: ISODateTime;
  readonly persisted: boolean;
}

export interface CompleteClinicalCollectionResult {
  readonly collection: ClinicalCollectionView;
  readonly persisted: boolean;
  readonly nextAttendanceStep: "Painel Clínico Integrado";
}

export interface UpdateClinicalPanelInput extends GetClinicalCollectionInput {
  readonly action: "CONFIRM_DATA";
}

export interface UpdateClinicalPanelResult {
  readonly panel: ClinicalPanelView;
  readonly persisted: boolean;
}

export interface ClinicalCollectionScenario {
  readonly key: ClinicalCollectionScenarioKey;
  readonly label: string;
  readonly description: string;
}

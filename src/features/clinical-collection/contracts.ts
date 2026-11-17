import type { ConsultationType } from "@/modules/attendance";
import type { ClinicalAnamnesisData } from "@/features/clinical-anamnesis/contracts";
import type { EntityId, ISODate, ISODateTime, ModuleKey } from "@/modules/shared";

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

export interface ClinicalAssessmentRecord<T> extends ClinicalStepRecord<T> {
  /**
   * Data clínica em que a avaliação foi realizada, no formato YYYY-MM-DD.
   * É distinta das datas de criação e atualização mantidas para auditoria.
   * Opcional durante a migração progressiva dos leitores atuais.
   */
  readonly assessmentDate?: ISODate;
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

export interface PosturalCorrectiveObjective {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: "LOW" | "MODERATE" | "HIGH";
  readonly expectedTimeframe?: string;
}

export interface PosturalStretchingExercise {
  readonly id: string;
  readonly exerciseName: string;
  readonly region?: string;
  readonly sets?: number;
  readonly durationSeconds?: number;
  readonly frequency?: string;
  readonly observation?: string;
}

export interface PosturalMobilityExercise {
  readonly id: string;
  readonly exerciseName: string;
  readonly objective?: string;
  readonly sets?: number;
  readonly repetitions?: number;
  readonly frequency?: string;
  readonly observation?: string;
}

export interface PosturalActivationExercise {
  readonly id: string;
  readonly muscleOrRegion?: string;
  readonly exerciseName: string;
  readonly sets?: number;
  readonly repetitions?: number;
  readonly durationSeconds?: number;
  readonly frequency?: string;
  readonly observation?: string;
}

export interface PosturalStabilityExercise {
  readonly id: string;
  readonly exerciseName: string;
  readonly objective?: string;
  readonly sets?: number;
  readonly repetitions?: number;
  readonly durationSeconds?: number;
  readonly frequency?: string;
  readonly observation?: string;
}

export interface PosturalMotorControlExercise {
  readonly id: string;
  readonly exerciseName: string;
  readonly objective?: string;
  readonly progression?: string;
  readonly sets?: number;
  readonly repetitions?: number;
  readonly durationSeconds?: number;
  readonly observation?: string;
}

export interface PosturalCorrectiveExercise {
  readonly id: string;
  readonly exerciseName: string;
  readonly objective?: string;
  readonly load?: string;
  readonly sets?: number;
  readonly repetitions?: number;
  readonly durationSeconds?: number;
  readonly intervalSeconds?: number;
  readonly frequency?: string;
  readonly observation?: string;
}

export interface PosturalPrecaution {
  readonly id: string;
  readonly type?:
    | "AVOID"
    | "RESTRICTION"
    | "COMPENSATION"
    | "ATTENTION"
    | "OTHER";
  readonly description: string;
  readonly observation?: string;
}

export interface PosturalEvolutionCriterion {
  readonly id: string;
  readonly criterion: string;
  readonly indicator?: string;
  readonly expectedResult?: string;
  readonly targetDate?: string;
  readonly observation?: string;
}

export interface PosturalCorrectivePlan {
  readonly objectives?: readonly PosturalCorrectiveObjective[];
  readonly stretching?: readonly PosturalStretchingExercise[];
  readonly mobility?: readonly PosturalMobilityExercise[];
  readonly activation?: readonly PosturalActivationExercise[];
  readonly stability?: readonly PosturalStabilityExercise[];
  readonly motorControl?: readonly PosturalMotorControlExercise[];
  readonly correctiveExercises?: readonly PosturalCorrectiveExercise[];
  readonly precautions?: readonly PosturalPrecaution[];
  readonly evolutionCriteria?: readonly PosturalEvolutionCriterion[];
  readonly generalNotes?: string;
  readonly approvedAt?: ISODateTime;
  readonly approvedBy?: ProfessionalAudit;
}

export interface PosturalReferenceLine {
  readonly id: string;
  readonly orientation: "HORIZONTAL" | "VERTICAL";
  /** Posição normalizada entre 0 e 1 dentro da área útil da imagem. */
  readonly position: number;
  readonly color: string;
  readonly thicknessPx?: number;
  readonly opacity?: number;
  readonly visible?: boolean;
}

export interface PosturalReferenceLines {
  readonly enabled?: boolean;
  readonly horizontal: readonly [
    PosturalReferenceLine,
    PosturalReferenceLine,
  ];
  readonly vertical: readonly [
    PosturalReferenceLine,
    PosturalReferenceLine,
  ];
}

export type PosturalAnnotationType =
  | "ARROW"
  | "TEXT"
  | "CIRCLE"
  | "FREEHAND";

export interface PosturalAnnotationPoint {
  /** Coordenada normalizada entre 0 e 1 dentro da área útil da imagem. */
  readonly x: number;
  /** Coordenada normalizada entre 0 e 1 dentro da área útil da imagem. */
  readonly y: number;
}

export interface PosturalAnnotationLayer {
  readonly id: string;
  readonly type: PosturalAnnotationType;
  readonly visible?: boolean;
  readonly color: string;
  readonly opacity?: number;
  readonly thicknessPx?: number;
  readonly rotationDeg?: number;
  readonly scale?: number;
  readonly start?: PosturalAnnotationPoint;
  readonly end?: PosturalAnnotationPoint;
  readonly center?: PosturalAnnotationPoint;
  readonly radius?: number;
  readonly text?: string;
  readonly points?: readonly PosturalAnnotationPoint[];
}

export interface PosturalComparisonMetadata {
  readonly comparisonAssessmentId?: EntityId;
  readonly comparisonAttendanceId?: EntityId;
  readonly selectedView?: PosturalViewKey;
  readonly observation?: string;
  readonly synchronizedViewport?: boolean;
}

export interface PosturalAssessmentData {
  readonly views: Readonly<Record<PosturalViewKey, PosturalViewData>>;
  readonly identifiedChanges: StructuredFindingState;
  readonly identifiedChangesNotes?: string;
  readonly functionalLimitations: StructuredFindingState;
  readonly functionalLimitationsNotes?: string;
  readonly notes?: string;
  /**
   * Campo legado preservado temporariamente para compatibilidade com
   * implementações anteriores do plano corretivo.
   */
  readonly futureCorrectiveExercisesNote?: string;
  readonly correctivePlan?: PosturalCorrectivePlan;
  readonly referenceLines?: Readonly<
    Partial<Record<PosturalViewKey, PosturalReferenceLines>>
  >;
  readonly annotationLayers?: Readonly<
    Partial<Record<PosturalViewKey, readonly PosturalAnnotationLayer[]>>
  >;
  readonly comparisonMetadata?: PosturalComparisonMetadata;
  readonly technicalSummary?: PosturalTechnicalSummary;
  readonly evaluatorConclusion?: string;
  readonly overallRelevance?: PosturalOverallRelevance;
  readonly followUp?: PosturalFollowUp;
  readonly completionStatus?: PosturalCompletionStatus;
}

export interface ClinicalCollectionRecords {
  readonly anthropometry: ClinicalAssessmentRecord<AnthropometryData>;
  readonly bioimpedance: ClinicalAssessmentRecord<BioimpedanceAvanutriData>;
  readonly perimetry: ClinicalAssessmentRecord<PerimetryData>;
  readonly posturalAssessment: ClinicalStepRecord<PosturalAssessmentData>;
}

export interface PreviousPerimetryReference {
  readonly measuredAt: ISODateTime;
  readonly values: PerimetryData;
  readonly audit: ProfessionalAudit;
}

export interface CurrentAttendanceAnamnesis {
  readonly entryId: EntityId;
  readonly masterRecordId: EntityId;
  readonly attendanceId: EntityId;
  readonly occurredAt: ISODateTime;
  readonly data: ClinicalAnamnesisData;
  readonly audit: ProfessionalAudit;
}

export interface ClinicalCollectionView {
  readonly patientId: EntityId;
  readonly patientName: string;
  readonly patientCode: string;
  readonly patientAge?: number;
  readonly patientSex?: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
  readonly patientProfession?: string;
  readonly patientPhone?: string;
  readonly attendanceId: EntityId;
  readonly attendanceStartedAt?: ISODateTime;
  readonly masterRecordId: EntityId;
  readonly consultationType: ConsultationType;
  readonly connectedProfessional: ProfessionalAudit;
  readonly records: ClinicalCollectionRecords;
  readonly anamnesis?: CurrentAttendanceAnamnesis;
  readonly summaryLoadIssue?: string;
  readonly anthropometryMeasuredAt?: ISODateTime;
  readonly bioimpedanceHeightCm?: number;
  readonly bioimpedanceMeasuredAt?: ISODateTime;
  readonly perimetryMeasuredAt?: ISODateTime;
  readonly posturalAssessedAt?: ISODateTime;
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
export type ClinicalStepSaveMode = "MANUAL" | "AUTOSAVE";

export function shouldCreateClinicalStepVersion(
  saveMode: ClinicalStepSaveMode = "MANUAL",
) {
  return saveMode === "MANUAL";
}

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
  readonly saveMode?: ClinicalStepSaveMode;
}

export type HistoricalClinicalAssessmentRecords =
  | {
      readonly anthropometry: AnthropometryData;
      readonly perimetry?: PerimetryData;
      readonly bioimpedance?: BioimpedanceAvanutriData;
    }
  | {
      readonly anthropometry?: AnthropometryData;
      readonly perimetry: PerimetryData;
      readonly bioimpedance?: BioimpedanceAvanutriData;
    }
  | {
      readonly anthropometry?: AnthropometryData;
      readonly perimetry?: PerimetryData;
      readonly bioimpedance: BioimpedanceAvanutriData;
    };

/**
 * Comando de criação de uma nova avaliação histórica independente.
 * Não identifica nem reutiliza a avaliação atual de um atendimento.
 */
export interface CreateHistoricalClinicalAssessmentInput {
  readonly patientId: EntityId;
  readonly assessmentDate: ISODate;
  readonly records: HistoricalClinicalAssessmentRecords;
}

export interface HistoricalClinicalAssessment {
  readonly id: EntityId;
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly assessmentDate: ISODate;
  readonly records: HistoricalClinicalAssessmentRecords;
  /** Data de digitação, preservada para auditoria. */
  readonly createdAt: ISODateTime;
  /** Data da última atualização, preservada para auditoria. */
  readonly updatedAt: ISODateTime;
  readonly version: number;
}

export interface CreateHistoricalClinicalAssessmentResult {
  readonly assessment: HistoricalClinicalAssessment;
  readonly persisted: boolean;
}

export interface SaveClinicalStepResult {
  readonly collection: ClinicalCollectionView;
  readonly savedAt: ISODateTime;
  readonly persisted: boolean;
}

export interface CompleteClinicalCollectionResult {
  readonly collection: ClinicalCollectionView;
  readonly persisted: boolean;
  readonly nextAttendanceStep: "Estratégia Nutricional";
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

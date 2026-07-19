import { BUILT_IN_IDS } from "@/modules/permissions";
import type {
  AnthropometryData,
  BioimpedanceAvanutriData,
  ClinicalCollectionRecords,
  ClinicalCollectionScenario,
  ClinicalCollectionScenarioKey,
  MockViewerKey,
  PerimetryData,
  PosturalAssessmentData,
  PreviousPerimetryReference,
  ProfessionalAudit,
} from "./contracts";
import type { SessionUser } from "@/features/mvp/contracts";

export const CLINICAL_DEMO_PATIENT_ID = "demo-patient-001";
export const CLINICAL_DEMO_ATTENDANCE_ID = "demo-attendance-001";
export const CLINICAL_DEMO_MASTER_RECORD_ID = "demo-master-record-001";

export const clinicalCollectionScenarios: readonly ClinicalCollectionScenario[] = [
  { key: "not-started", label: "Coleta não iniciada", description: "Atendimento ativo sem etapa de coleta iniciada." },
  { key: "partial-saulo", label: "Parcial por Saulo", description: "Antropometria preenchida e bioimpedância em andamento." },
  { key: "maria-continuity", label: "Continuidade por Maria", description: "Mesmo prontuário; Maria vê e reutiliza o registro de Saulo." },
  { key: "complete", label: "Coleta completa", description: "Todas as etapas obrigatórias concluídas." },
  { key: "mandatory-pending", label: "Pendência obrigatória", description: "Uma vista postural obrigatória ainda não foi avaliada." },
  { key: "integrity-missing", label: "Integridade pendente", description: "Coleta declarada concluída com um valor obrigatório ausente." },
  { key: "previous-comparison", label: "Comparação anterior", description: "Perimetria atual comparada a uma avaliação anterior." },
];

export const sauloAudit: ProfessionalAudit = {
  professionalUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
  professionalName: "Saulo Xavier Vitorino",
  updatedAt: "2026-07-16T09:42:00-03:00",
  version: 2,
};

export const mariaAudit: ProfessionalAudit = {
  professionalUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
  professionalName: "Maria de Lourdes Gomes",
  updatedAt: "2026-07-16T10:18:00-03:00",
  version: 1,
};

export const completeAnthropometry: AnthropometryData = {
  weightKg: 82.4,
  heightCm: 178,
  bmi: 26,
  notes: "Registro demonstrativo reutilizado pelo atendimento.",
};

export const completeBioimpedance: BioimpedanceAvanutriData = {
  weightKg: 82.4,
  bodyFatPercent: 18.7,
  fatMassKg: 15.4,
  fatFreeMassKg: 67,
  skeletalMuscleMassKg: 36.1,
  totalBodyWaterL: 49.1,
  intracellularWaterL: 30.7,
  extracellularWaterL: 18.4,
  bmi: 26,
  visceralFatLevel: 8,
  basalMetabolicRateKcal: 1768,
  appendicularIndex: 8.4,
  metabolicAgeYears: 36,
  proteinKg: 13.3,
  mineralsKg: 4.2,
  leanRightArmKg: 3.8,
  leanLeftArmKg: 3.7,
  leanTrunkKg: 29.4,
  leanRightLegKg: 10.5,
  leanLeftLegKg: 10.4,
  fatRightArmKg: 1.1,
  fatLeftArmKg: 1.1,
  fatTrunkKg: 7.6,
  fatRightLegKg: 2.8,
  fatLeftLegKg: 2.8,
};

export const partialBioimpedance: BioimpedanceAvanutriData = {
  weightKg: 82.4,
  bodyFatPercent: 18.7,
  fatMassKg: 15.4,
  fatFreeMassKg: 67,
  skeletalMuscleMassKg: 36.1,
};

export const completePerimetry: PerimetryData = {
  neckCm: 39.2,
  shouldersCm: 118.5,
  chestCm: 101.4,
  waistCm: 86.2,
  abdomenCm: 89.1,
  hipCm: 100.3,
  rightArmCm: 35.6,
  leftArmCm: 35.3,
  rightForearmCm: 29.1,
  leftForearmCm: 28.9,
  rightThighCm: 59.8,
  leftThighCm: 59.4,
  rightCalfCm: 38.7,
  leftCalfCm: 38.5,
  notes: "Valores exclusivamente demonstrativos.",
};

const previousPerimetryValues: PerimetryData = {
  neckCm: 39.2,
  shouldersCm: 117.9,
  chestCm: 101.1,
  waistCm: 87.4,
  abdomenCm: 90.3,
  hipCm: 100.5,
  rightArmCm: 35.1,
  leftArmCm: 35,
  rightForearmCm: 28.9,
  leftForearmCm: 28.8,
  rightThighCm: 59.3,
  leftThighCm: 59.1,
  rightCalfCm: 38.6,
  leftCalfCm: 38.4,
};

export const previousPerimetry: PreviousPerimetryReference = {
  measuredAt: "2026-06-18T14:00:00-03:00",
  values: previousPerimetryValues,
  audit: { ...sauloAudit, updatedAt: "2026-06-18T14:28:00-03:00", version: 1 },
};

export const emptyPostural: PosturalAssessmentData = {
  views: {
    ANTERIOR: { state: "NOT_ASSESSED" },
    POSTERIOR: { state: "NOT_ASSESSED" },
    RIGHT_LATERAL: { state: "NOT_ASSESSED" },
    LEFT_LATERAL: { state: "NOT_ASSESSED" },
  },
  identifiedChanges: "NOT_ASSESSED",
  functionalLimitations: "NOT_ASSESSED",
  futureCorrectiveExercisesNote: "Vínculo de exercícios corretivos será disponibilizado em Sprint futura.",
};

export const completePostural: PosturalAssessmentData = {
  views: {
    ANTERIOR: { state: "NO_FINDING_RECORDED" },
    POSTERIOR: { state: "FINDING_RECORDED", observation: "Achado demonstrativo registrado para validação visual." },
    RIGHT_LATERAL: { state: "NO_FINDING_RECORDED" },
    LEFT_LATERAL: { state: "NO_FINDING_RECORDED" },
  },
  identifiedChanges: "FINDING_RECORDED",
  identifiedChangesNotes: "Alteração demonstrativa; sem interpretação clínica nesta Sprint.",
  functionalLimitations: "NO_FINDING_RECORDED",
  notes: "Avaliação demonstrativa realizada nas quatro vistas obrigatórias.",
  futureCorrectiveExercisesNote: "Nenhum exercício vinculado nesta Sprint.",
};

export const posturalWithMandatoryPending: PosturalAssessmentData = {
  ...completePostural,
  views: { ...completePostural.views, LEFT_LATERAL: { state: "NOT_ASSESSED" } },
};

const origin = (entryId: string, moduleKey: "PHYSICAL_ASSESSMENT" | "BIOIMPEDANCE" | "PERIMETRY" | "POSTURAL_ASSESSMENT", label: string) => ({
  masterRecordId: CLINICAL_DEMO_MASTER_RECORD_ID,
  entryId,
  moduleKey,
  label,
});

const incompleteRecords: ClinicalCollectionRecords = {
  anthropometry: { status: "COMPLETED", data: completeAnthropometry, missingRequiredFields: [], origin: origin("demo-entry-anthropometry", "PHYSICAL_ASSESSMENT", "Prontuário Mestre"), audit: sauloAudit },
  bioimpedance: { status: "IN_PROGRESS", data: partialBioimpedance, missingRequiredFields: [], origin: origin("demo-entry-bioimpedance", "BIOIMPEDANCE", "Avanutri · coleta atual"), audit: sauloAudit },
  perimetry: { status: "NOT_STARTED", data: {}, missingRequiredFields: [], origin: origin("demo-entry-perimetry", "PERIMETRY", "Coleta atual") },
  posturalAssessment: { status: "NOT_STARTED", data: emptyPostural, missingRequiredFields: [], origin: origin("demo-entry-postural", "POSTURAL_ASSESSMENT", "Avaliação atual") },
};

const completedRecords: ClinicalCollectionRecords = {
  anthropometry: { ...incompleteRecords.anthropometry },
  bioimpedance: { status: "COMPLETED", data: completeBioimpedance, missingRequiredFields: [], origin: incompleteRecords.bioimpedance.origin, audit: sauloAudit },
  perimetry: { status: "COMPLETED", data: completePerimetry, missingRequiredFields: [], origin: incompleteRecords.perimetry.origin, audit: sauloAudit },
  posturalAssessment: { status: "COMPLETED", data: completePostural, missingRequiredFields: [], origin: incompleteRecords.posturalAssessment.origin, audit: mariaAudit },
};

const notStartedRecords: ClinicalCollectionRecords = {
  anthropometry: { status: "NOT_STARTED", data: {}, missingRequiredFields: [], origin: incompleteRecords.anthropometry.origin },
  bioimpedance: { status: "NOT_STARTED", data: {}, missingRequiredFields: [], origin: incompleteRecords.bioimpedance.origin },
  perimetry: { status: "NOT_STARTED", data: {}, missingRequiredFields: [], origin: incompleteRecords.perimetry.origin },
  posturalAssessment: { status: "NOT_STARTED", data: emptyPostural, missingRequiredFields: [], origin: incompleteRecords.posturalAssessment.origin },
};

const integrityMissingRecords: ClinicalCollectionRecords = {
  ...completedRecords,
  bioimpedance: {
    ...completedRecords.bioimpedance,
    data: { ...completeBioimpedance, mineralsKg: undefined },
  },
};

export interface ClinicalCollectionMockSeed {
  readonly viewer: MockViewerKey;
  readonly records: ClinicalCollectionRecords;
  readonly previousPerimetry?: PreviousPerimetryReference;
  readonly lastSavedStep?: "ANTHROPOMETRY" | "BIOIMPEDANCE" | "PERIMETRY" | "POSTURAL_ASSESSMENT";
  readonly completed?: boolean;
}

export const clinicalCollectionMockSeeds: Readonly<Record<ClinicalCollectionScenarioKey, ClinicalCollectionMockSeed>> = {
  "not-started": { viewer: "SAULO", records: notStartedRecords },
  "partial-saulo": { viewer: "SAULO", records: incompleteRecords, lastSavedStep: "ANTHROPOMETRY" },
  "maria-continuity": { viewer: "MARIA", records: incompleteRecords, lastSavedStep: "ANTHROPOMETRY" },
  complete: { viewer: "SAULO", records: completedRecords, lastSavedStep: "POSTURAL_ASSESSMENT", completed: true },
  "mandatory-pending": {
    viewer: "SAULO",
    records: { ...completedRecords, posturalAssessment: { ...completedRecords.posturalAssessment, status: "IN_PROGRESS", data: posturalWithMandatoryPending } },
    lastSavedStep: "PERIMETRY",
  },
  "integrity-missing": { viewer: "SAULO", records: integrityMissingRecords, lastSavedStep: "POSTURAL_ASSESSMENT", completed: true },
  "previous-comparison": { viewer: "MARIA", records: completedRecords, previousPerimetry, lastSavedStep: "POSTURAL_ASSESSMENT", completed: true },
};

export function resolveClinicalMockSessionUser(defaultUser: SessionUser, scenario?: string | null): SessionUser {
  if (scenario !== "maria-continuity" && scenario !== "previous-comparison") return defaultUser;
  return {
    id: BUILT_IN_IDS.users.mariaDeLourdesGomes,
    fullName: "Maria de Lourdes Gomes",
    email: "maria@saulo-ai.local",
    status: "ACTIVE",
    roleName: "Profissional compartilhada",
  };
}
